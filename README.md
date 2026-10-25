# Empieza a tiempo

Sitio web estático, oscuro y con glassmorfismo, basado en una guía práctica para dejar de trabajar solo bajo urgencia. Incluye el método completo (regla de los 2 minutos, micro-pasos, urgencia controlada, bloques agendados, recompensas tempranas y reducción de fricción) y herramientas interactivas para ponerlo en práctica.

No necesita instalación, servidor ni dependencias: es HTML, CSS y JavaScript puro.

## Estructura

```
.
├── index.html   # Contenido y estructura de la página
├── styles.css   # Diseño: tokens de color, glassmorfismo, layout y responsive
└── script.js    # Temporizador, micro-pasos, registro de arranque y plan semanal
```

## Cómo usarlo

1. Guarda los tres archivos en la misma carpeta.
2. Abre `index.html` en el navegador (doble clic).

Las fuentes (Bricolage Grotesque y Hanken Grotesk) se cargan desde Google Fonts. Sin conexión, el sitio usa las fuentes del sistema y sigue funcionando.

## Qué incluye

**Contenido**
- Hero con el planteamiento de la guía.
- Seis cambios para empezar a tiempo, en tarjetas de cristal.
- Plan de cinco pasos para empezar esta misma semana.

**Herramientas interactivas**
- **Temporizador** de 2, 25 y 40 minutos con anillo de progreso, aviso sonoro opcional, vibración en móviles compatibles y contador de arranques completados hoy. Mientras corre, el tiempo restante aparece en el título de la pestaña y el resplandor del fondo se intensifica.
- **Micro-pasos:** lista de pasos pequeños para una tarea, con barra de progreso y un aviso si tienes menos de 4 o más de 6 pasos.
- **Ejemplos por área:** estudios, programación y trabajos universitarios cargan una primera lista de micro-pasos.
- **Registro de arranque (5 días):** marca si empezaste a tiempo, anota la dificultad de 1 a 10 y consulta la media, la mejor racha y la tendencia.
- **Plan semanal:** casillas con barra de progreso.

## Datos y privacidad

Todo se guarda en el `localStorage` de tu navegador, con el prefijo `empieza-a-tiempo:`. No se envía nada a ningún servidor.

| Clave        | Contenido                                |
| ------------ | ---------------------------------------- |
| `sound`      | Sonido del temporizador activado o no    |
| `today`      | Arranques completados hoy                |
| `steps`      | Tarea y lista de micro-pasos             |
| `days`       | Registro de arranque de 5 días           |
| `plan`       | Casillas del plan semanal                |

Para borrar los datos usa "Limpiar lista" y "Reiniciar registro" dentro de la página, o borra los datos del sitio desde los ajustes del navegador.

## Personalizar

**Colores y estilo** (`styles.css`, bloque `:root` al inicio):
- `--ember`, `--ember-hi`, `--ember-lo`: acento cálido (botones, anillo, casillas).
- `--dusk`: acento frío (notas y detalles).
- `--ink`: color base del fondo.
- Las luces del fondo están en `.glow-dusk`, `.glow-sea` y `.glow-dawn`.
- La intensidad del cristal se ajusta en `.glass` (`blur(24px)` y los degradados de `background`).

**Duraciones del temporizador:** edita el objeto `MODES` en `script.js` (etiqueta, mensaje inicial y mensaje final de cada modo). Si cambias los minutos, actualiza también los atributos `data-minutes` de los botones `.seg-btn` en `index.html`; deben coincidir con las claves de `MODES`.

**Ejemplos de micro-pasos:** edita el objeto `PRESETS` en `script.js`. Para añadir un área nueva, agrega la entrada y un botón con `data-preset="tu-clave"` en `index.html`.

**Textos:** todo el contenido está en `index.html`.

## Compatibilidad

- Navegadores modernos (Chrome, Edge, Firefox, Safari).
- El efecto de cristal usa `backdrop-filter`. Si el navegador no lo soporta, las tarjetas pasan a un fondo oscuro opaco y la página sigue siendo legible.
- Diseño responsive, con menú desplegable en móvil.

## Accesibilidad

- Enlace "Saltar al contenido" y foco visible en todos los controles.
- Controles con etiquetas y estados (`aria-pressed`, `aria-expanded`) para lectores de pantalla.
- Se respeta `prefers-reduced-motion`: se reducen las animaciones y el desplazamiento suave.

## Publicarlo

Al ser un sitio estático, sirve cualquier hosting gratuito: GitHub Pages, Netlify, Cloudflare Pages o Vercel. Sube los tres archivos a la raíz del proyecto, con `index.html` como página principal.
