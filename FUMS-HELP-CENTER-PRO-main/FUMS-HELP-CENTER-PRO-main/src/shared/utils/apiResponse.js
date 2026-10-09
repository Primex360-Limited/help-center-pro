export default function successResponse(res, message, data = {}, status = 200, meta = undefined) {
    const payload = {
        success: true,
        message,
        data
    }

    if(meta && Object.keys(meta).length > 0){
        payload.meta = meta;
    }
    return res.status(status).json(payload);
}