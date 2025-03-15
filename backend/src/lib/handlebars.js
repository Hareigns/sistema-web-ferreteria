// import { format } from "timeago.js";
import Handlebars from "handlebars";

const helpers = {};
/*
helpers.timeago = (timestamp) => {
  return format(timestamp);
};
*/
Handlebars.registerHelper('ifEqual', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context);
});

export { Handlebars }; // Exporta ambos como named exports