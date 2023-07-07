const compressing = require('compressing')

compressing.zip
    .compressDir('dist', './server/dist.zip')
    .then((res) => {
        console.log(res)
    })
    .catch((err) => {
        console.log(err)
    })
