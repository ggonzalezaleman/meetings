import { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { once } from 'events';

let cachedServer: any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!cachedServer) {
    try {
      const app = await NestFactory.create(AppModule);
      // (Optional) Apply any global pipes, filters, or middleware here.
      await app.init();
      // Cache the underlying HTTP server instance from Nest
      cachedServer = app.getHttpAdapter().getInstance();
    } catch (error) {
      console.error("Error bootstrapping Nest application:", error);
      res.status(500).send("Error bootstrapping Nest application");
      return;
    }
  }

  // Emit the request to the NestJS server.
  try {
    cachedServer.emit("request", req, res);
  } catch (error) {
    console.error("Error emitting request to Nest server:", error);
    res.status(500).send("Internal server error");
    return;
  }

  // Wait for the response to finish by listening for the 'finish' or 'close' event.
  // Also use a timeout to force resolution if nothing fires within 10 seconds.
  await new Promise<void>((resolve) => {
    let resolved = false;
    const finishHandler = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    res.once('finish', finishHandler);
    res.once('close', finishHandler);

    // Fallback timeout: after 10 seconds, if the response hasn't ended, force it.
    setTimeout(() => {
      if (!res.writableEnded) {
        console.warn("Timeout reached, forcing response end.");
        res.end();
      }
      finishHandler();
    }, 10000);
  });
}
