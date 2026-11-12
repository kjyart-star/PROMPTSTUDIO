import { handle, type Env } from '../src/serve';

export const onRequest = ({ request, env }: { request: Request; env: Env }) => handle(request, env);
