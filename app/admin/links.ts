// Portal links the admin surface hands out. One place so the default view
// (open tickets, priority-sorted) stays identical wherever it's copied,
// opened, or shown after creating a client.

const DEFAULT_VIEW = 'status=open&sort=priority';

export const adminOrigin = () => (typeof window !== 'undefined' ? window.location.origin : '');

/** Portal for a magic-link token — client token sees all projects, project token just its own. */
export const portalLink = (token: string) => `${adminOrigin()}/c/${token}/comments?${DEFAULT_VIEW}`;

/** Same portal, scoped to one project via the scope pill's `?project=` param. */
export const projectPortalLink = (clientToken: string, projectId: number) =>
  `${portalLink(clientToken)}&project=${projectId}`;
