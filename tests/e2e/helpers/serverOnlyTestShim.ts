import Module from 'node:module';

type ModuleLoad = (this: unknown, request: string, parent?: unknown, isMain?: boolean) => unknown;
type ShimmedModule = {
  _load: ModuleLoad;
  __locallyServerOnlyShimInstalled?: boolean;
  __locallyOriginalModuleLoad?: ModuleLoad;
};

const moduleLoader = Module as unknown as ShimmedModule;

if (!moduleLoader.__locallyServerOnlyShimInstalled) {
  const originalModuleLoad = moduleLoader._load;
  moduleLoader.__locallyOriginalModuleLoad = originalModuleLoad;
  moduleLoader._load = function loadWithServerOnlyShim(request, parent, isMain) {
    if (request === 'server-only') {
      return {};
    }

    return originalModuleLoad.call(this, request, parent, isMain);
  };
  moduleLoader.__locallyServerOnlyShimInstalled = true;
}
