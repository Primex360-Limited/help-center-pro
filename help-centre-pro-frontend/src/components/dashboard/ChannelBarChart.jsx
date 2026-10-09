import { formatNumber } from "../../utils/format.js";

export default function ChannelBarChart({ channels = [], series = [] }) {
  const maxValue = Math.max(
    1,
    ...channels.flatMap((channel) => [channel.created || 0, channel.resolved || 0])
  );
  const niceMax = Math.ceil(maxValue / 4) * 4 || 4;
  const ticks = [0, niceMax / 4, niceMax / 2, (niceMax * 3) / 4, niceMax];

  return (
    <div className="channel-chart">
      <div className="channel-chart__plot">
        <div className="channel-chart__y-label">Active Cases</div>
        <div className="channel-chart__grid">
          {ticks
            .slice()
            .reverse()
            .map((tick) => (
              <div key={tick} className="channel-chart__grid-line">
                <span>{formatNumber(tick)}</span>
              </div>
            ))}
        </div>

        <div className="channel-chart__bars">
          {channels.map((channel) => {
            const createdHeight = Math.max(2, ((channel.created || 0) / niceMax) * 100);
            const resolvedHeight = Math.max(2, ((channel.resolved || 0) / niceMax) * 100);
            return (
              <div key={channel.channel} className="channel-chart__group">
                <div className="channel-chart__pair">
                  <div
                    className="channel-chart__bar channel-chart__bar--created"
                    style={{ height: `${createdHeight}%` }}
                    title={`Created: ${channel.created}`}
                  />
                  <div
                    className="channel-chart__bar channel-chart__bar--resolved"
                    style={{ height: `${resolvedHeight}%` }}
                    title={`Resolved: ${channel.resolved}`}
                  />
                </div>
                <div className="channel-chart__label">{channel.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="channel-chart__legend">
        {series.map((item) => (
          <div key={item.key} className="channel-chart__legend-item">
            <span style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
