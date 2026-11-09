// Lets Node import the app's extensionless "./Constants" style paths by trying ".js".
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) { if (spec.startsWith(".") && !/\.\w+$/.test(spec)) return next(spec + ".js", ctx); throw e; }
}
