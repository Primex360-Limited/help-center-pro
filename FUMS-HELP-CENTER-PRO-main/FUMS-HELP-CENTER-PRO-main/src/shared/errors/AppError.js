export class AppError extends Error {
    constructor(message, statusCode = 500, errors = []){
        super(message);
        this.statusCode = statusCode;
        this.success = false;
        this.errors = errors;        
        Error.captureStackTrace?.(this, this.constructor);
    }
}