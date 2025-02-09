import { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

let cachedServer: any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Bootstrap the NestJS app if it hasn't been initialized yet.
  if (!cachedServer) {
    try {
      // Disable bodyParser if needed (optional) – adjust options as required.
      const app = await NestFactory.create(AppModule, { bodyParser: false });
      // Initialize the app
      await app.init();
      // Cache the underlying Express instance.
      cachedServer = app.getHttpAdapter().getInstance();
    } catch (error) {
      console.error("Error bootstrapping Nest application:", error);
      res.status(500).send("Error bootstrapping Nest application");
      return;
    }
  }

  // Call the Express instance as a function, which returns when the request is handled.
  try {
    await new Promise<void>((resolve, reject) => {
      // cachedServer is the Express app, so we can call it as a function.
      cachedServer(req, res, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    console.error("Error processing request in Nest application:", error);
    res.status(500).send("Error processing request");
  }
}
