// Entry for hosts that load the app with require() (e.g. Hostinger / LiteSpeed).
// The server is an ES module with top-level await, so it has to be loaded with import().
import('./src/server.js').catch((err) => {
  console.error(err);
  process.exit(1);
});
