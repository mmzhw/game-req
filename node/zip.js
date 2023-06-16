const compressing = require('compressing')

compressing.zip
    .compressDir('dist', './node/dist.zip')
    .then((res) => {
        console.log(res)
    })
    .catch((err) => {
        console.log(err)
    })
