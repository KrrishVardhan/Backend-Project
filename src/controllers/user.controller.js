import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (user_id) => {
    try {
        const user = await User.findById(user_id)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new apiError(500, "something went wrong while generating refresh and access tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    /* 
    --- ALGORITHM TO FOLLOW IN ORDER TO BUILD THE USER REGISTRATION LOGIC --- 
        1. get user details
        2. validation
        3. check if user already exists: using email or username
        4. check for coverimage and avatar(required)
        5. upload them to cloudinary, check for avatar again
        6. make user object - create entry in db
        7. remove password and refresh token from response
        8. check if user is created successfully
        9. return the res
    */

    // LOGIC
    // 1. Destructuring
    const { fullName, username, password, email } = req.body;
    // console.log(email);  tested output by giving JSON input from postman

    // 2. Validations
    if ([fullName, username, password, email].some((field) =>
        field?.trim() === "") // checks if atleast one field is empty of not if yes throw error
    ) {
        throw new apiError(400, "All fields are required...");
    }
    // 3. Check for Existing User
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new apiError(409, "Username or Email Already Exists")
    }

    // 4. Check for Cover and Avatar images using the multer middleware which will be saved in the ../public/temp folder before uploading on cloudinary
    const avatarLocalPath = req.files?.avatar && req.files.avatar.length > 0
        ? req.files.avatar[0].path
        : null;
    let coverImageLocalPath; // checking coverimage exists or not, the above method is not working as it is working for avatar
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    // 5.1 Special Check on Avatar image
    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar image is required")
    }

    // 5.2 Upload on Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath) // await bcs it takes time to upload
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new apiError(400, "Avatar image is required")
    }
    // 6. Make user object and creating entry in DB
    const user = await User.create({
        // _id made by mongodb itself
        fullName,
        username: username.toLowerCase(),
        avatar: avatar.url,
        coverImage: coverImage?.url || "", // bcs user might not have given the cover image
        email,
        password
    })
    // 7. 8. Check of user is created and remove password and refreshToken for showing response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new apiError(500, "Something went wrong while registering the user")
    }
    // 9. Response using apiResponse
    return res.status(201).json(
        new apiResponse(200, createdUser, "Successfully Registered the user")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    /* 
    --- ALGORITHM TO FOLLOW IN ORDER TO BUILD THE USER LOGIN LOGIC --- 
        1. get user details
        2. validations for email/username and password
        3. check if the user is registered 
        4. check password
        5. generate access and refresh tokens
        6. send cookies
        7. response for success
    */
    // 1.
    const { username, email, password } = req.body
    // 2.
    if (!username && !email) {
        throw new apiError(400, "username or email is required");
    }
    // check if user does not exist
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) {
        throw new apiError(404, "User does not exist")
    }

    // 3. 4. if exists check password
    const isPasswordValid = user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new apiError(401, "Invalid Login credentials")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
    // Using Destructuring we directly took access and refresh tokens instead of first making an object

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    // returning everything except password and refresh token from the user document

    const options = {
        httpOnly: true, // only modifiable by the server
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new apiResponse(200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User Logged in Successfully"
            )
        )


})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true // this will give us new value meaning the response with undefined refreshToken
        }
    )
    // we can access req.user because we made a middleware that gives the req object access to the user with the same access token they had. Meaning now we have the Document of the exact user we need to delete refreshToken of from the database

    const options = {
        httpOnly: true, // only modifiable by the server
        secure: true
    }
    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new apiResponse(200, {}, "User Logged out successfully!")
        )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) {
        throw new apiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new apiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new apiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token")
    }
})

export { registerUser, loginUser, logoutUser, refreshAccessToken }