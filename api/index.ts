import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "http";
import { AppModule } from "../src/app.module"; // Adjust if needed
import { NestFactory } from "@nestjs/core";

// We'll store the Node server here for re-use (to enable fast starts).
let server: Server;

/**
 * This function boots the NestJS app exactly once, then reuses it.
 */
async function bootstrapServer(): Promise<Server> {
  if (server) {
    return server;
  }

  // Create a Nest application from your compiled AppModule
  const app = await NestFactory.create(AppModule);

  // (Optional) apply any global pipes, filters, etc. if needed
  // app.useGlobalPipes(new ValidationPipe());

  // Initialize the app (but don't call .listen())
  await app.init();

  // Create an HTTP server from the Nest app's handler
  const expressApp = app.getHttpAdapter().getInstance();
  server = createServer(expressApp);

  return server;
}

/**
 * Vercel will call this exported function (the serverless "handler") for every request.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const s = await bootstrapServer();
  s.emit("request", req, res);
}
