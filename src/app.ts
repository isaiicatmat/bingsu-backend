import { join } from 'path';
import AutoLoad, {AutoloadPluginOptions} from '@fastify/autoload';
import { FastifyPluginAsync } from 'fastify';

export type AppOptions = {
  // Place your custom options for app below here.
} & Partial<AutoloadPluginOptions>;

const app: FastifyPluginAsync<AppOptions> = async (
    fastify,
    opts
): Promise<void> => {
  // Place here your custom code!

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts
  })

  void fastify.register(require('@fastify/cors'), function (instance) {
    return (req: any, callback: any) => {
      let corsOptions;
      const origin = req.headers.origin;
      // for api testing
      if (origin) {
        const hostname = new URL(origin).hostname;
        // do not include CORS headers for requests from localhost
        if (hostname === "localhost") {
          corsOptions = { origin: true };
          // todo check allow origin header
        } else {
          corsOptions = { origin: true };
        }
      } else {
        corsOptions = { origin: true };
      }

      callback(null, corsOptions) // callback expects two parameters: error and options
    }
  });
};

export default app;
export { app }
