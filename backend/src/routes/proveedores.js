import express from 'express';
const router = express.Router();
import { isLoggedIn } from "../lib/auth.js";

<<<<<<< HEAD
router.get("/add", isLoggedIn, (req, res) => {
  res.render("proveedores/add");
=======
import {isLoggedIn} from "../lib/auth.js"

// Definir rutas
router.get("/add", isLoggedIn,  (req, res) => {
    res.render("proveedores/add");
>>>>>>> 7db4c5822599be3b59b25d30950f0afd8aef7712
});


// Exportar el router
export { router }; // Exportación nombrada