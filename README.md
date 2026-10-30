# EquTree

Web app to solve complex equations in a tree format. <br>
Sample of the app can be found at: https://equtree.surge.sh/

Write an equation in a root card. Every variable in it gets its own child
card holding the equation for that variable, and so on down the tree. Values
flow up from the leaves to the root as you type.

## Features

- Equations are typed with [MathQuill](http://mathquill.com/): fractions,
  roots (`sqrt`, nth roots), powers, `|x|`, trig and inverse trig, `ln`/`log`
  (`log_2(8)` works too), `π`, `e`, factorials.
- Missing variables are flagged on the card in red, with a one-click
  **+ name** chip that creates their card and a **×** that takes the variable
  out of the equation instead. Cards whose variable isn't used by the parent
  are marked **unused**.
- Results update live through the whole tree. Arrows run from each variable
  into the equation that uses it, labelled with the variable and its value,
  and attach to whichever side faces the other card.
- **Share values**: drag the ● on a card's tab onto another card to use its
  value there too, so one card can feed any number of equations (under a
  different name in each if you like). The × on a line's label cuts that one
  connection, and the unlink button turns a card into a tree of its own.
- **✓** (or Enter) locks a solved branch. Editing cards are dragged by their
  tab, locked cards from anywhere; the pencil unlocks them.
- **Plots**: an equation graphed against one of its plain-number inputs, like
  a graphing calculator, with every other input as a "what if" slider (the
  cards themselves don't change). Lines can also show the cards in between, or
  any card dropped onto the plot; a dropped card's inputs become x-axis
  choices too. Drag to pan, scroll to zoom, double-click to fit.
- Several **canvases**, each with its own trees, plots and view, all saved in
  the browser's local storage.
- **Undo/redo** with Ctrl+Z / Ctrl+Y (or the buttons), a right-click menu on
  cards, plots and the canvas, Shift+drag to move a whole branch or tree, and
  a confirmation before anything is deleted.
- Rename anything by double-clicking it, resize cards from their corner, pan,
  zoom, fit all, tidy layout, a minimap, and light/dark themes. Lines can be
  bold, and curved (the default) or right-angled.
- **Calculus mode** (sidebar): equations can also hold derivatives
  (`d/dx`, `dΦ/dt`, `d^2/dx^2`), definite integrals (`int`, limits can be
  `infty`), sums and products (`sum`, `prod`, sums can run to `infty`) and
  limits (`lim_{x->0}`). A derivative like `dΦ/dt` is taken through the tree:
  at the value of the card named `t`, with `Φ`'s own card recomputed around
  it, so `EMF = -N dΦ/dt` with `Φ = B·A·cos(ωt)` just works, and plots too.
  Everything is computed numerically.

## Development

```sh
npm install
npm start      # http://localhost:3000
npm test       # unit tests for the LaTeX converter, evaluator, layout and state
npm run build
```

## Code map

- `src/lib/latex.js`: converts MathQuill LaTeX into mathjs expressions.
- `src/lib/evaluate.js`: evaluates every tree and works out missing or unused variables.
- `src/lib/layout.js`: card placement, tidy layout, bounding boxes and connector geometry.
- `src/lib/calculus.js`: numeric derivatives, integrals, sums, products and limits.
- `src/lib/plot.js`: sampling, ranges and ticks for plot cards.
- `src/lib/tree.js`: helpers for walking a canvas's cards.
- `src/hooks/useTree.js`: the canvas and tree reducers, persistence and the `useTree()` context hook.
- `src/Components/`: the canvas, equation and plot cards, connectors, minimap and sidebar.
