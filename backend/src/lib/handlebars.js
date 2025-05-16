import Handlebars from "handlebars";

// Helper para comparación
Handlebars.registerHelper('ifEqual', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

// Helper seguro para JSON
Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context || []).replace(/"/g, '&quot;');
});

// Helper para formatear fechas
Handlebars.registerHelper('formatDate', function(dateString) {
  return new Date(dateString).toLocaleDateString('es-ES');
});

// Helper para debug
Handlebars.registerHelper('debug', function(value) {
  console.log('Debug Handlebars:', value);
  return '';
});

Handlebars.registerHelper('safeArray', function(array, options) {
  if (!array || array.length === 0) {
    return '[]';
  }
  return options.fn(this);
});

export { Handlebars };