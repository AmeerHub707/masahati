# Masahati — Frontend

Frontend for the Masahati project (Gaza). Built with React 19 + Vite.

## Stack
- React 19, Vite 8
- ESLint (flat config)
- Plain CSS (centralized semantic classes)

## Getting started
```bash
npm install
npm run dev      # local dev server (HMR)
npm run build    # production build -> dist/
npm run lint     # eslint .
npm run preview  # preview the production build
```

## Folder structure
```
src/
├── assets/        # images, svg, static media
├── components/    # reusable UI components
│   └── common/    # buttons, inputs, cards, modals...
├── context/       # React context providers
├── hooks/         # custom React hooks
├── layouts/       # page layouts (nav + footer shells)
├── pages/         # route-level screens
├── routes/        # router config (React Router)
├── services/      # API calls / external integrations
├── styles/        # global / shared CSS
├── utils/         # pure helper functions
├── App.jsx        # root component
├── main.jsx       # entry point
└── index.css      # global styles
```

## Team conventions
- Default-export React components, one component per file.
- Use semantic CSS classes in `index.css` / `styles/` — no Tailwind, no CSS Modules yet.
- Naming: PascalCase for components/pages, camelCase for hooks/utils.
- Branch from `main`. PRs require a passing `npm run lint`.
- Never commit `node_modules/`, `dist/`, or `.env*` (already gitignored).
```
