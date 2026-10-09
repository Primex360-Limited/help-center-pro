export default function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const payload = {
        success: false,
        message: err.message || "Internal Server Error"
    }

    if(Array.isArray(err.errors) && err.errors.length > 0){
        payload.errors = err.errors;
    }

    res.status(statusCode).json(payload);
}