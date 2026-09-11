const withImages = require('next-images')
module.exports = withImages({
  trailingSlash: true,
  // three.js ships modern class syntax that Terser (Next 12) can't parse
  swcMinify: true,
})
