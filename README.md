# Trig Playground

三角関数を「公式として覚える」のではなく、単位円・座標・波形の動きとして直感的に理解するためのインタラクティブWebアプリです。

## Current interaction

- 単位円をドラッグして角度を直接操作
- x = cos θ / y = sin θ を投影線と数値で同期表示
- sin / cos の波形を同じ角度カーソルで同期表示
- 代表角（0° / 30° / 45° / 60° / 90° / 180° / 270° / 360°）
- 自動再生と速度調整
- スマートフォンのタッチ操作に対応

## Development

```bash
npm install
npm run dev
```

品質チェック:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Tech stack

- React
- TypeScript
- Vite
- Vitest
- ESLint

## Product direction

最初の体験は、1つの角度を動かすと次の表現がすべて同期して動くことを重視します。

- 単位円上の点
- x = cos θ / y = sin θ
- sin / cos の波形
- 度数法 / 弧度法
- 数値表示

詳細な開発方針は `AGENTS.md` を参照してください。
