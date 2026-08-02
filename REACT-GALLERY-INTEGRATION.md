# Optional React / shadcn migration

This repository is currently static HTML/CSS/JavaScript, so the live gallery uses a dependency-free equivalent in gallery.js and gallery.css.

To migrate later:

1. npm create vite@latest react-site -- --template react-ts
2. cd react-site and run npm install
3. Run npx shadcn@latest init and keep the default @/components/ui alias.
4. Run npm install framer-motion @radix-ui/react-aspect-ratio clsx tailwind-merge
5. Copy the prepared files from components/ui and lib/utils.ts.

The components/ui path matters because shadcn generation, registry imports, and aliases expect UI primitives there. The adapted component accepts real image data and uses intrinsic image dimensions, so it never crops assets or changes layout randomly.