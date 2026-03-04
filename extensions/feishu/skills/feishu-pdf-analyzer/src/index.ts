import { type OpenClawPluginApi } from "openclaw/plugin-sdk";
import { type FeishuConfig } from "../../src/types.js";
import { Type } from "@sinclair/typebox";
import { listEnabledFeishuAccounts, resolveFeishuAccount } from "../../src/accounts.js";
import { createFeishuClient } from "../../src/client.js";
import { downloadMessageResourceFeishu } from "../../src/media.js";

const AnalyzePdfsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message_id", "prompt"],
  properties: {
    message_id: { type: "string", description: "The message_id containing the PDF files to analyze." },
    prompt: { type: "string", description: "The specific analysis prompt or question." },
    account_id: { type: "string", description: "Optional specific feishu account to use." }
  },
} as const;

export function registerFeishuPdfAnalyzerSkill(api: OpenClawPluginApi) {
  if (!api.config) return;

  const accounts = listEnabledFeishuAccounts(api.config);
  if (accounts.length === 0) return;

  api.registerTool({
    plugin: {
      id: "feishu",
      toolFactory: (ctx) => {
        return {
          name: "analyze_pdfs",
          label: "Analyze PDFs",
          description: "Download PDFs from a Feishu message and summarize them using Aliyun DashScope Qwen-Long model.",
          parameters: AnalyzePdfsSchema,
          async execute(_toolCallId, params) {
            const p = params as { message_id: string; prompt: string; account_id?: string };
            const env = api.runtime.env;
            const dashscopeKey = env.DASHSCOPE_API_KEY;
            
            if (!dashscopeKey) {
              return JSON.stringify({ error: "DASHSCOPE_API_KEY environment variable is not configured." });
            }

            try {
              api.logger.info?.(`[feishu-pdf-analyzer] Processing message: ${p.message_id}`);
              
              const account = resolveFeishuAccount({ cfg: api.config!, accountId: p.account_id });
              if (!account.configured) {
                return JSON.stringify({ error: "Feishu account not configured." });
              }

              const client = createFeishuClient(account);
              
              // 1. Fetch message to get file keys
              const response = (await client.im.message.get({
                path: { message_id: p.message_id },
              })) as any;

              if (response.code !== 0 || !response.data?.items || response.data.items.length === 0) {
                 return JSON.stringify({ error: "Failed to fetch message or message not found." });
              }

              const item = response.data.items[0];
              const contentStr = item.body?.content;
              if (!contentStr) {
                return JSON.stringify({ error: "Message has no content." });
              }

              const parsedContent = JSON.parse(contentStr);
              const fileKey = parsedContent.file_key;
              const fileName = parsedContent.file_name || "unknown.pdf";

              if (!fileKey) {
                 return JSON.stringify({ error: "No file found in the specified message." });
              }

              // 2. Download file
              api.logger.info?.(`[feishu-pdf-analyzer] Downloading file: ${fileKey}`);
              const { buffer } = await downloadMessageResourceFeishu({
                cfg: api.config!,
                messageId: p.message_id,
                fileKey: fileKey,
                type: "file",
                accountId: account.accountId
              });

              // 3. Upload to DashScope
              api.logger.info?.(`[feishu-pdf-analyzer] Uploading to DashScope: ${fileName}`);
              const formData = new FormData();
              const blob = new Blob([buffer], { type: 'application/pdf' });
              formData.append('file', blob, fileName);
              formData.append('purpose', 'file-extract');

              const uploadRes = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/files', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${dashscopeKey}`
                },
                body: formData
              });

              if (!uploadRes.ok) {
                const errText = await uploadRes.text();
                throw new Error(`DashScope upload failed for ${fileName}: ${errText}`);
              }

              const uploadData = await uploadRes.json() as any;
              if (!uploadData.id) throw new Error(`DashScope upload failed, no file ID returned for ${fileName}`);
              const fileId = uploadData.id;

              // 4. Summarize with Qwen-long
              api.logger.info?.(`[feishu-pdf-analyzer] Generating summary with Qwen-long for file ID: ${fileId}`);
              const messages = [
                { role: 'system', content: 'You are a professional legal document analysis assistant. Please analyze the provided files and extract accurate summaries and key points. Output in Markdown format.' },
                { role: 'system', content: `fileid://${fileId}` },
                { role: 'user', content: p.prompt || 'Please extract the key information from the above document and generate a concise summary.' }
              ];

              const llmRes = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${dashscopeKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: 'qwen-long',
                  messages: messages
                })
              });

              if (!llmRes.ok) {
                const errText = await llmRes.text();
                throw new Error(`LLM generation failed: ${errText}`);
              }

              const llmData = await llmRes.json() as any;
              const summary = llmData.choices?.[0]?.message?.content || 'Failed to generate summary.';

              return JSON.stringify({ 
                success: true, 
                file: fileName,
                summary: summary
              });

            } catch (err: any) {
              api.logger.error?.(`[feishu-pdf-analyzer] Error: ${err.message}`);
              return JSON.stringify({ error: err.message });
            }
          },
        };
      },
    },
  });
}
