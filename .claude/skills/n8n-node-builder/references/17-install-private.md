# Install private nodes

Source: https://docs.n8n.io/connect/create-nodes/deploy-your-node/install-private-nodes.md

For internal/self-hosted use without publishing to npm. **Not available on
n8n Cloud** — cloud requires the community node repository path.

## Docker
1. Start from n8n's base Dockerfile and customize it.
2. `npm run build` your node, then copy the **node** and **credential**
   directories from `dist/` into the image's `~/.n8n/custom/` directory.
3. Download `docker-entrypoint.sh` and place it next to your Dockerfile.
4. Build:
   ```shell
   docker build --build-arg N8N_VERSION=<version> --tag=customizedn8n .
   ```

## Environment variables
- `N8N_VERSION` — required build arg, format `X.XXX.X`, keep aligned with
  your target deployment's n8n version.
- `NODE_ICU_DATA=/usr/local/lib/node_modules/full-icu` — needed for
  internationalization support in the custom image.

## Global n8n install (non-Docker)
If n8n is installed globally, install your node package inside that same
n8n installation — it's auto-detected from there. (For local dev/testing this
is the same flow as [13-run-locally.md](13-run-locally.md).)
