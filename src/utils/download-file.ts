export const downloadFile = (jsonObject: any, fileName: string) => {
    try {
        // 将 JSON 对象转换为字符串
        const jsonString = JSON.stringify(jsonObject, null, 4)

        // 创建一个 Blob 对象
        const blob = new Blob([jsonString], { type: 'text/plain;charset=utf-8' })

        // 创建下载链接
        const downloadLink = document.createElement('a')
        downloadLink.href = URL.createObjectURL(blob)
        downloadLink.download = fileName

        // 添加到 DOM 并触发点击
        document.body.appendChild(downloadLink)
        downloadLink.click()

        // 清理
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(downloadLink.href)

        console.log('JSON 已编码并下载')
        return true
    } catch (error) {
        console.error('下载编码后的 JSON 时出错:', error)
        return false
    }
}
