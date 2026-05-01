
// 未知错误
class CustomError extends Error {
  constructor(message) {
    super(message);
    this.name = "CustomError"
  }
}

// 请求成功
const success = (res, message, data) => {
  res.status(200).json({
    code: 200,
    message,
    data
  })
}

// 请求失败
const fail = (res, error) => {
  if (error.name === 'NotFoundError') {
    return res.status(404).json({
      code: 404,
      message: "资源不存在",
      errors: [
        error.message
      ]
    })
  }
  res.status(500).json({
    code: 500,
    message: "服务器错误",
    errors: [error.message]
  })

}

module.exports = {
  CustomError,
  success,
  fail
}
