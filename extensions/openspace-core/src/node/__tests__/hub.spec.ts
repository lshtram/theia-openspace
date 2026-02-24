/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect } from 'chai';
import express, { Application } from 'express';
import { AddressInfo } from 'net';
import { Server } from 'http';
import { OpenSpaceHub } from '../hub';

type LoggerLike = {
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
};

function makeLogger(): LoggerLike {
    return {
        info: () => undefined,
        debug: () => undefined,
        warn: () => undefined,
        error: () => undefined,
    };
}

function makeHub(): OpenSpaceHub {
    const hub = new OpenSpaceHub();
    (hub as any).logger = makeLogger();
    return hub;
}

async function startServer(app: Application): Promise<{ server: Server; baseUrl: string }> {
    const server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = (server.address() as AddressInfo).port;
    return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function stopServer(server: Server): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
    });
}

describe('OpenSpaceHub routes (REQ-SYS-011, REQ-SYS-014)', () => {
    let app: Application;
    let hub: OpenSpaceHub;
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
        app = express();
        app.use(express.json());

        hub = makeHub();
        hub.configure(app);

        const started = await startServer(app);
        server = started.server;
        baseUrl = started.baseUrl;
    });

    afterEach(async () => {
        await stopServer(server);
    });

    it('serves GET /openspace/instructions as plain text with command guidance', async () => {
        const response = await fetch(`${baseUrl}/openspace/instructions`);
        expect(response.status).to.equal(200);

        const body = await response.text();
        expect(body).to.include('OpenSpace IDE Control');
        expect(body).to.include('openspace.pane.open');
        expect(body).to.include('openspace.editor.open');
    });

    it('rejects POST /openspace/manifest without origin header', async () => {
        const response = await fetch(`${baseUrl}/openspace/manifest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ commands: [] }),
        });

        expect(response.status).to.equal(403);
        const body = await response.json() as { error?: string };
        expect(body.error).to.include('Origin header required');
    });

    it('accepts POST /openspace/manifest with valid origin and commands array', async () => {
        const response = await fetch(`${baseUrl}/openspace/manifest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'http://localhost:3000',
            },
            body: JSON.stringify({
                commands: [
                    {
                        id: 'openspace.pane.list',
                        description: 'List panes',
                        args: [],
                    },
                ],
            }),
        });

        expect(response.status).to.equal(200);
        const body = await response.json() as { success?: boolean };
        expect(body.success).to.equal(true);
    });

    it('rejects POST /openspace/manifest with invalid payload shape', async () => {
        const response = await fetch(`${baseUrl}/openspace/manifest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'http://localhost:3000',
            },
            body: JSON.stringify({ commands: 'not-an-array' }),
        });

        expect(response.status).to.equal(400);
        const body = await response.json() as { error?: string };
        expect(body.error).to.include('Invalid manifest');
    });
});
