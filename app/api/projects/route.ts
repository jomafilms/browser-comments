import { NextRequest, NextResponse } from 'next/server';
import { initDB, createProject, getProjectsByClientId, resolveToken, getClients, getProjectById } from '@/lib/db';

// Initialize database on first request
let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

// Check admin secret
function isAdmin(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;

  const url = new URL(request.url);
  const providedSecret = url.searchParams.get('admin');
  return providedSecret === adminSecret;
}

// GET - List projects for a client
export async function GET(request: NextRequest) {
  await ensureDB();

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const token = searchParams.get('token');

  try {
    // If token provided, resolve to client or project scope
    if (token) {
      const ctx = await resolveToken(token);
      if (!ctx) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
      }
      // Project token: return only that project
      if (ctx.projectId) {
        const project = await getProjectById(ctx.projectId);
        return NextResponse.json(project ? [project] : []);
      }
      // Client token: return all projects
      const projects = await getProjectsByClientId(ctx.clientId);
      return NextResponse.json(projects);
    }

    // If clientId provided (admin use)
    if (clientId) {
      if (!isAdmin(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const projects = await getProjectsByClientId(parseInt(clientId));
      return NextResponse.json(projects);
    }

    // No filter - return all projects (admin only)
    if (!isAdmin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all projects from all clients
    const clients = await getClients();
    const allProjects = [];
    for (const client of clients) {
      const projects = await getProjectsByClientId(client.id);
      allProjects.push(...projects.map(p => ({ ...p, client_name: client.name })));
    }
    return NextResponse.json(allProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST - Create a new project (admin only)
export async function POST(request: NextRequest) {
  await ensureDB();

  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clientId, name, url } = await request.json();

    if (!clientId || !name || !url) {
      return NextResponse.json({ error: 'clientId, name, and url are required' }, { status: 400 });
    }

    const project = await createProject(clientId, name, url);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
