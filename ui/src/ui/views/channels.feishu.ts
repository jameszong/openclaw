import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelAccountSnapshot, FeishuStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderFeishuCard(params: {
  props: ChannelsProps;
  feishu?: FeishuStatus;
  feishuAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, feishu, feishuAccounts, accountCountLabel } = params;
  const hasMultipleAccounts = feishuAccounts.length > 1;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const probe = account.probe as { botName?: string } | undefined;
    const botName = probe?.botName;
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${botName ? `${botName}` : label}
          </div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">Running</span>
            <span>${account.running ? "Yes" : "No"}</span>
          </div>
          <div>
            <span class="label">Configured</span>
            <span>${account.configured ? "Yes" : "No"}</span>
          </div>
          <div>
            <span class="label">Last inbound</span>
            <span>${account.lastInboundAt ? formatRelativeTimestamp(account.lastInboundAt) : "n/a"}</span>
          </div>
          ${
            account.lastError
              ? html`
                <div class="account-card-error">
                  ${account.lastError}
                </div>
              `
              : nothing
          }
        </div>
      </div>
    `;
  };

  return html`
    <div class="card">
      <div class="card-title">Feishu (飞书)</div>
      <div class="card-sub">Bot status and channel configuration.</div>
      ${accountCountLabel}

      ${
        hasMultipleAccounts
          ? html`
            <div class="account-card-list">
              ${feishuAccounts.map((account) => renderAccountCard(account))}
            </div>
          `
          : html`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">Configured</span>
                <span>${feishu?.configured ? "Yes" : "No"}</span>
              </div>
              <div>
                <span class="label">Running</span>
                <span>${feishu?.running ? "Yes" : "No"}</span>
              </div>
              <div>
                <span class="label">Last start</span>
                <span>${feishu?.lastStartAt ? formatRelativeTimestamp(feishu.lastStartAt) : "n/a"}</span>
              </div>
              <div>
                <span class="label">Last probe</span>
                <span>${feishu?.lastProbeAt ? formatRelativeTimestamp(feishu.lastProbeAt) : "n/a"}</span>
              </div>
            </div>
          `
      }

      ${
        feishu?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
            ${feishu.lastError}
          </div>`
          : nothing
      }

      ${
        feishu?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
            Probe ${feishu.probe.ok ? "ok" : "failed"} ·
            ${feishu.probe.status ?? ""} ${feishu.probe.error ?? ""}
          </div>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "feishu", props })}

      <div class="row" style="margin-top: 12px;">
        <button class="btn" @click=${() => props.onRefresh(true)}>
          Probe
        </button>
      </div>
    </div>
  `;
}
