import { Router } from "express";
import { loginUser, logoutUser, registerUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();


router.route("/register").post(
    // adding middleware for checking upload of images
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ])
    , registerUser)

// Router for login for the user
router.route("/login").post(loginUser)

// Secured routes
router.route("/logout").post(
    verifyJWT
    ,logoutUser)
export default router;