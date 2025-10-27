// Writting first custom Middleware
import { User } from "../models/user.model";
import { apiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken"

// adding "next" for giving access to next function after this middleware's work is done
export const verifyJWT = asyncHandler(async (req, _, next) => {
    // getting the Access Token from either the cookies or the header, in header the format is Authorization: Bearer <token>. By using .replace we get the token only removing the "Bearer "
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

        if (!token) {
            throw new apiError(401, "Unauthorized request")
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
        if (!user) {
            throw new apiError(401, "Invalid access token ")
        }

        req.user = user
        next()
    } catch (error) {
        throw new apiError(401, "Invalid access token")
    }
})