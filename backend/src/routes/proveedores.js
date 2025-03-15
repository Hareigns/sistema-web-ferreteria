import express from 'express';
const router = express.Router();
import { isLoggedIn } from "../lib/auth.js";

router.get("/add", isLoggedIn, (req, res) => {
  res.render("proveedores/add");
});


// Exportar el router
export { router }; // Exportación nombrada