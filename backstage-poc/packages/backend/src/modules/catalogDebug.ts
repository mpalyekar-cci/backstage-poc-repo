/**
 * Logs catalog locations and GitHub token presence at startup to help debug catalog loading.
 */
import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';

export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'catalog-debug',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        lifecycle: coreServices.rootLifecycle,
        logger: coreServices.rootLogger,
      },
      async init({ config, lifecycle, logger }) {
        lifecycle.addStartupHook(() => {
          const log = logger.child({ module: 'catalog-debug' });
          try {
            const locations = config.getOptionalConfigArray('catalog.locations');
            const count = locations?.length ?? 0;
            log.info(`Catalog locations in config: ${count}`);
            if (locations) {
              locations.forEach((loc, i) => {
                const type = loc.getOptionalString('type');
                const target = loc.getOptionalString('target');
                log.info(`  [${i}] type=${type} target=${target ?? '(none)'}`);
              });
            }
            const ghList = config.getOptionalConfigArray('integrations.github');
            const firstGh = ghList?.length ? ghList[0] : undefined;
            const hasToken =
              Boolean(process.env.GITHUB_TOKEN) ||
              Boolean(firstGh?.getOptionalString('token'));
            if (hasToken) {
              log.info('GITHUB_TOKEN (or integrations.github token) is set');
            } else {
              log.warn(
                'GITHUB_TOKEN not set - GitHub URL locations may fail (404/403 for private repos)',
              );
            }
          } catch (e) {
            log.warn('Could not read catalog config for debug', { error: String(e) });
          }
        });
      },
    });
  },
});
