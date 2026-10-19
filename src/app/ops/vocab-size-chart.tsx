import type { ActiveVocabSizePoint } from "@/features/vocabulary";
import styles from "./ops.module.css";

// 手札語彙の語数の移り変わりのグラフ（SVG）。横幅は固定で、横軸（文生成の通し番号）と縦軸（語数）は、全部が収まるように自動で調整する。
const width = 760;
const height = 220;
const padding = { left: 44, right: 20, top: 18, bottom: 34 };

type VocabSizeChartProps = {
  history: ActiveVocabSizePoint[];
  // 今の文生成の通し番号（グラフの右端）と、今の語数
  currentSeq: number;
  currentSize: number;
};

export function VocabSizeChart({ history, currentSeq, currentSize }: VocabSizeChartProps) {
  if (history.length === 0) {
    return <p className={styles.empty}>まだ手札語彙がありません。</p>;
  }

  // 版が変わった点と、今の点
  const points = [...history.map((point) => ({ seq: point.generationSeq, size: point.size, point })), { seq: currentSeq, size: currentSize, point: null }];
  const xMax = Math.max(1, ...points.map((point) => point.seq));
  const sizes = points.map((point) => point.size);
  // 縦軸の目盛りは、きりのよい間隔（1, 2, 5, 10, 20, 50…）にする
  const step = niceStep((Math.max(...sizes) - Math.min(...sizes) + 10) / 4);
  const yMin = Math.max(0, Math.floor((Math.min(...sizes) - 3) / step) * step);
  const yMax = Math.ceil((Math.max(...sizes) + 3) / step) * step;

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (seq: number) => padding.left + (seq / xMax) * plotWidth;
  const y = (size: number) => padding.top + (1 - (size - yMin) / (yMax - yMin)) * plotHeight;

  // 点と点の間を、なめらかな曲線でつなぐ（行き過ぎないように、制御点は横方向にだけ置く）
  const line = points
    .map((point, index) => {
      if (index === 0) {
        return `M ${x(point.seq)} ${y(point.size)}`;
      }
      const previous = points[index - 1];
      const middle = (x(previous.seq) + x(point.seq)) / 2;
      return `C ${middle} ${y(previous.size)} ${middle} ${y(point.size)} ${x(point.seq)} ${y(point.size)}`;
    })
    .join(" ");
  const area = `${line} L ${x(points.at(-1)?.seq ?? 0)} ${padding.top + plotHeight} L ${x(points[0].seq)} ${padding.top + plotHeight} Z`;

  const yTicks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, index) => yMin + step * index);
  // 文生成がまだ少ないと、真ん中と右端の目盛りが同じ数になるので、同じ数は1つにまとめる
  const xTicks = [...new Set([0, Math.round(xMax / 2), xMax])];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} role="img" aria-label="手札語彙の語数の移り変わり">
      <defs>
        <linearGradient id="vocab-size-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-mint)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-mint)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="vocab-size-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--color-mint)" />
          <stop offset="100%" stopColor="var(--color-lavender)" />
        </linearGradient>
      </defs>

      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} className={styles.chartGrid} />
          <text x={padding.left - 8} y={y(tick)} className={styles.chartLabel} textAnchor="end" dominantBaseline="middle">
            {Math.round(tick)}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <text key={tick} x={x(tick)} y={height - 12} className={styles.chartLabel} textAnchor="middle">
          {tick}
        </text>
      ))}
      <text x={width - padding.right} y={height - 0} className={styles.chartLabel} textAnchor="end">
        文生成の回数
      </text>

      <path d={area} fill="url(#vocab-size-area)" />
      <path d={line} fill="none" stroke="url(#vocab-size-line)" strokeWidth="2.5" />

      {points.map(({ seq, size, point }) =>
        point === null ? (
          <circle key="current" cx={x(seq)} cy={y(size)} r="4" className={styles.chartCurrent}>
            <title>{`今：${size} 語（文生成 ${seq} 回目）`}</title>
          </circle>
        ) : (
          <g key={point.version}>
            <circle cx={x(seq)} cy={y(size)} r="5" className={styles.chartPoint}>
              <title>{`版 ${point.version}：${size} 語（文生成 ${seq} 回目${point.version === 1 ? "・ベースライン" : `・＋${point.added} −${point.removed}`}）`}</title>
            </circle>
            {/* 右端の近くでは、ラベルが切れないように、点の左側に寄せて書く */}
            <text
              x={x(seq) > width - padding.right - 80 ? x(seq) + 6 : x(seq)}
              y={y(size) - 12}
              className={styles.chartPointLabel}
              textAnchor={x(seq) > width - padding.right - 80 ? "end" : "middle"}
            >
              {point.version === 1 ? `${size}` : `${size}（+${point.added}/−${point.removed}）`}
            </text>
          </g>
        ),
      )}
    </svg>
  );
}

function niceStep(rough: number): number {
  return [1, 2, 5, 10, 20, 50, 100, 200, 500].find((step) => step >= rough) ?? 1000;
}
