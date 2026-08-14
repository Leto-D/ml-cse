import type { Client } from '~/types';
import { alsaceLait } from './alsace-lait';

/**
 * Point d'entrée unique du contenu.
 *
 * Toutes les landings connues sont enregistrées ici. `activeClient` désigne
 * celle qui est construite par `src/pages/index.astro`.
 *
 * Pour basculer sur un autre client : ajouter sa config au registre, puis
 * changer la constante ci-dessous — ou définir CLIENT=<id> dans l'environnement
 * de build Netlify pour déployer plusieurs sites depuis le même dépôt.
 */
export const clients = {
  'alsace-lait': alsaceLait,
} satisfies Record<string, Client>;

export type ClientId = keyof typeof clients;

const requested = import.meta.env.CLIENT as string | undefined;
const fallback: ClientId = 'alsace-lait';

function resolve(id: string | undefined): Client {
  if (id && id in clients) return clients[id as ClientId];
  if (id) {
    console.warn(
      `[clients] CLIENT="${id}" inconnu. Repli sur "${fallback}". ` +
        `Clients disponibles : ${Object.keys(clients).join(', ')}.`
    );
  }
  return clients[fallback];
}

export const activeClient: Client = resolve(requested);
