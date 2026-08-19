# public/models/

Empty on purpose. **No `.glb`/`.gltf` files are bundled with this project.**

Rather than auto-downloading third-party models (which could carry licenses
we haven't verified for you, or attribution requirements the app doesn't
surface), every building/vehicle/landmark you see today is procedural —
generated from code, not loaded from a file. See `src/data/modelRegistry.ts`
for the registry that's ready to receive real assets, and the root
`README.md` section "Adding your own 3D models" for the exact steps.

## Folder convention

- `buildings/` — individual building exteriors (villa, hospital, university,
  mall, airport terminal, office tower, apartment block)
- `vehicles/` — cars, bus, ambulance, fire truck, police car
- `landmarks/` — one-off hero objects (the Downtown tower)
- `interiors/` — interior-specific meshes/props (furniture kits, fixtures)
- `environment/` — trees, street furniture, or any other environment prop
  you'd rather model than generate procedurally

## If you add a model here

1. Drop the `.glb` in the matching subfolder.
2. Add or update its entry in `src/data/modelRegistry.ts` — set `path` to
   `/models/<folder>/<file>.glb` and `available: true`.
3. **Fill in `license` and `source`** on that registry entry. This is not
   optional — every model in the registry has those fields for a reason:
   so anyone reading the code later (including future-you) can tell at a
   glance what's safe to ship and what isn't.
4. Keep triangle counts modest for anything that will be instanced at city
   scale (a few hundred–low thousands of triangles is a reasonable target).

Good sources for properly licensed models: your own original work,
CC0/public-domain sets (e.g. Kenney.nl's city/building packs), or anything
you hold a commercial license for. Whatever the source, record it in the
registry entry.
