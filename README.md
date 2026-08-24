# Trig Playground

三角関数を「公式として覚える」のではなく、単位円・座標・波形の動きとして直感的に理解するためのインタラクティブWebアプリです。

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
