# Guía de Vectorización de Contactos

Esta guía explica cómo usar la funcionalidad de vectorización de contactos para encontrar contactos con intereses similares.

## ¿Qué es la Vectorización?

La vectorización convierte la información de texto de un contacto (nombre, empresa, experiencia, educación) en un vector numérico que captura el significado semántico. Esto permite encontrar contactos similares basándose en sus intereses profesionales y trasfondo.

## Configuración Inicial

### 1. Configurar Firebase Vector Search

Para usar la búsqueda nativa de vectores en Firestore, necesitas crear un índice:

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Hacer login
firebase login

# Configurar el proyecto
firebase use tu-proyecto-id

# Crear el índice de vectores
firebase firestore:indexes --project=tu-proyecto-id
```

Luego aplica la configuración del archivo `firestore-indexes.json`:

```bash
firebase deploy --only firestore:indexes
```

### 2. Configurar OpenAI API Key

Asegúrate de tener la API key de OpenAI configurada en tu archivo `.env`:

```env
OPENAI_API_KEY=tu_api_key_aqui
```

## API Endpoints

### Vectorización

#### 1. Vectorizar un contacto específico
```http
POST /api/vectors/vectorize/:jid
```

Ejemplo:
```bash
curl -X POST http://localhost:3000/api/vectors/vectorize/1234567890@s.whatsapp.net
```

#### 2. Vectorizar todos los contactos (en lotes)
```http
POST /api/vectors/vectorize-all
Content-Type: application/json

{
  "limit": 20
}
```

#### 3. Re-vectorizar un contacto (si tiene información actualizada)
```http
POST /api/vectors/revectorize/:jid
```

### Búsqueda de Contactos Similares

#### 1. Buscar por texto descriptivo
```http
POST /api/vectors/search
Content-Type: application/json

{
  "query": "desarrollador web frontend React",
  "limit": 10,
  "minSimilarity": 0.3,
  "useVectorSearch": false
}
```

#### 2. Buscar contactos similares a un contacto específico
```http
GET /api/vectors/similar/:jid?limit=10&minSimilarity=0.3
```

Ejemplo:
```bash
curl "http://localhost:3000/api/vectors/similar/1234567890@s.whatsapp.net?limit=5"
```

### Gestión

#### 1. Ver estadísticas de vectorización
```http
GET /api/vectors/stats
```

#### 2. Obtener un contacto vectorizado
```http
GET /api/vectors/:jid
```

#### 3. Eliminar un contacto vectorizado
```http
DELETE /api/vectors/:jid
```

## Ejemplos de Uso

### Buscar Desarrolladores Web
```bash
curl -X POST http://localhost:3000/api/vectors/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "desarrollador web frontend React JavaScript",
    "limit": 5,
    "minSimilarity": 0.4
  }'
```

### Buscar Profesionales de Marketing
```bash
curl -X POST http://localhost:3000/api/vectors/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "marketing digital social media growth hacking",
    "limit": 10,
    "minSimilarity": 0.3
  }'
```

### Encontrar Contactos Similares a uno Específico
```bash
curl "http://localhost:3000/api/vectors/similar/contact_jid@s.whatsapp.net?limit=5&minSimilarity=0.4"
```

## Respuestas de la API

### Respuesta Exitosa de Búsqueda
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "contact": {
          "jid": "1234567890@s.whatsapp.net",
          "name": "Juan Pérez",
          "email": "juan@empresa.com",
          "linkedinData": {
            "headline": "Frontend Developer at Tech Company",
            "company": "Tech Company",
            "experience": ["React", "JavaScript", "TypeScript"]
          },
          "embeddingText": "Name: Juan Pérez | Professional Title: Frontend Developer | Company: Tech Company | Experience: React, JavaScript, TypeScript",
          "vectorizedAt": "2024-01-15T10:30:00Z"
        },
        "similarity": 0.85,
        "distance": 0.15
      }
    ],
    "count": 1,
    "searchParams": {
      "query": "desarrollador frontend React",
      "limit": 10,
      "minSimilarity": 0.3,
      "method": "manual"
    }
  }
}
```

### Respuesta de Estadísticas
```json
{
  "success": true,
  "data": {
    "totalContacts": 150,
    "vectorizedContacts": 75,
    "percentage": 50.0
  }
}
```

## Funcionalidad Automática

### Auto-vectorización

El sistema vectoriza automáticamente los contactos cuando:
1. Se encuentra información de LinkedIn durante el flujo de bienvenida
2. Se actualiza la información de LinkedIn de un contacto existente

La auto-vectorización se ejecuta en segundo plano sin interrumpir el flujo principal.

### Programación de Vectorización

Puedes programar la vectorización automática para que se ejecute periódicamente:

```typescript
import { scheduleAutoVectorization } from './src/services/autoVectorization.js'

// Ejecutar cada 60 minutos
scheduleAutoVectorization(60)
```

## Calidad de Vectorización

El sistema evalúa la calidad de la información disponible para vectorización:

- **Información básica** (peso menor): nombre, email
- **Información de LinkedIn** (peso mayor): perfil, empresa, experiencia, educación

### Puntuación de Calidad
- `0.0 - 0.3`: Información insuficiente
- `0.3 - 0.6`: Información básica
- `0.6 - 0.8`: Información buena
- `0.8 - 1.0`: Información excelente

## Consideraciones Técnicas

### Modelos de Embedding
- **Modelo actual**: `text-embedding-3-small` (OpenAI)
- **Dimensiones**: 1536
- **Ventajas**: Eficiente, económico, buena calidad

### Métodos de Búsqueda

#### 1. Búsqueda Manual (`useVectorSearch: false`)
- Calcula similitudes en memoria
- Funciona sin configuración adicional
- Más lenta para grandes volúmenes

#### 2. Búsqueda Nativa (`useVectorSearch: true`)
- Usa Firestore Vector Search
- Requiere índices configurados
- Más eficiente para grandes volúmenes

### Límites y Costos

#### Límites de API
- Vectorización por lote: máximo 50 contactos
- Resultados de búsqueda: máximo 50 contactos
- Dimensión máxima de vector: 1536

#### Costos (OpenAI)
- `text-embedding-3-small`: ~$0.00002 por 1K tokens
- Contacto promedio: ~100 tokens
- Costo por contacto: ~$0.000002

## Solución de Problemas

### Error: "OpenAI API key is missing"
- Verifica que `OPENAI_API_KEY` esté configurado en `.env`
- Reinicia la aplicación después de agregar la clave

### Error: "Firestore not initialized"
- Verifica las credenciales de Firebase
- Asegúrate de que el proyecto esté configurado correctamente

### Error: "Vector search failed"
- Verifica que los índices de Firestore estén creados
- El sistema automáticamente usa búsqueda manual como respaldo

### Contacto no se vectoriza
- Verifica que tenga información de LinkedIn o email corporativo
- Revisa los logs para errores específicos

## Mejores Prácticas

1. **Vectoriza gradualmente**: Usa lotes pequeños para evitar límites de API
2. **Monitorea costos**: Revisa el uso de la API de OpenAI regularmente
3. **Calidad de datos**: Contactos con más información LinkedIn generan mejores vectores
4. **Similitud mínima**: Usa 0.3-0.4 como umbral para resultados relevantes
5. **Actualización**: Re-vectoriza cuando se actualice información significativa

## Integración con el Flujo Existente

La vectorización se integra automáticamente con:
- **Flujo de bienvenida**: Auto-vectorización cuando se encuentra LinkedIn
- **Enriquecimiento de datos**: Re-vectorización con nueva información
- **API de contactos**: Endpoints adicionales para búsqueda similar

No interfiere con la funcionalidad existente y es completamente opcional.

## 🚀 Firebase Cloud Functions (Nuevo)

### Vectorización Automática con Cloud Functions

Hemos implementado Firebase Cloud Functions que vectorizan automáticamente los contactos cuando completan el flujo de bienvenida:

#### Función Principal: `onContactStatusChange`
- **Trigger**: Se ejecuta automáticamente cuando un contacto cambia a estado `completed`
- **Acción**: Vectoriza el contacto y lo guarda en `vectorized-contacts`
- **Ventaja**: Completamente automático, sin intervención manual

#### Configuración de Cloud Functions

1. **Configurar API Key de OpenAI**:
```bash
firebase functions:config:set openai.api_key="tu_openai_api_key"
```

2. **Instalar dependencias**:
```bash
cd functions
npm install
```

3. **Desplegar funciones**:
```bash
firebase deploy --only functions
```

#### Funciones Disponibles

##### 1. Vectorización Automática (Trigger)
```javascript
// Se ejecuta automáticamente - no requiere llamada manual
// Trigger: contacts/{contactId} - onUpdate
```

##### 2. Vectorización Manual
```javascript
const result = await firebase.functions().httpsCallable('vectorizeContact')({
  contactId: 'contact_jid_here'
});
```

##### 3. Vectorización en Lotes
```javascript
const result = await firebase.functions().httpsCallable('vectorizeBatch')({
  limit: 50,
  forceRevectorize: false
});
```

##### 4. Vectorización Programada
- Se ejecuta automáticamente cada 60 minutos
- Procesa contactos que puedan haberse perdido
- Máximo 10 contactos por ejecución

#### Ventajas de Cloud Functions

✅ **Automático**: Se ejecuta sin intervención cuando los contactos se completan
✅ **Escalable**: Maneja picos de volumen automáticamente
✅ **Confiable**: Reintenta automáticamente en caso de errores temporales
✅ **Eficiente**: Solo vectoriza contactos con información completa
✅ **Monitoreable**: Logs detallados en Firebase Console

#### Monitoreo de Cloud Functions

1. **Ver logs**:
```bash
firebase functions:log
```

2. **Ver logs específicos**:
```bash
firebase functions:log --only onContactStatusChange
```

3. **Métricas en Firebase Console**:
- Número de ejecuciones
- Errores y fallos
- Duración promedio
- Memoria utilizada

#### Estructura del Proyecto

```
hackTheChat/
├── functions/                    # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts             # Funciones principales
│   │   ├── types/interfaces.ts   # Tipos compartidos
│   │   └── services/vectorization.ts
│   ├── package.json
│   └── README.md
├── firebase.json                # Configuración Firebase
├── firestore.rules             # Reglas de seguridad
└── firestore-indexes.json      # Índices de Firestore
```

### Flujo Completo de Vectorización

1. **Contacto inicia flujo** → `status: 'new'`
2. **Completa información** → `status: 'completed'`
3. **Cloud Function se activa** → `onContactStatusChange`
4. **Vectorización automática** → Guarda en `vectorized-contacts`
5. **Búsqueda disponible** → Contacto listo para búsquedas similares

### Configuración de Producción

Para un entorno de producción robusta:

1. **Configurar alertas**:
```bash
# Configurar notificaciones de errores
firebase functions:config:set alerts.email="tu@email.com"
```

2. **Configurar límites**:
```bash
# Configurar memoria y timeout para funciones pesadas
# En functions/src/index.ts:
.runWith({
  timeoutSeconds: 540,
  memory: '1GB'
})
```

3. **Monitoreo continuo**:
- Configurar alertas en Firebase Console
- Monitorear costos de OpenAI
- Revisar logs regularmente

Esta implementación asegura que todos los contactos que completen el flujo de bienvenida sean vectorizados automáticamente, permitiendo búsquedas similares inmediatas sin intervención manual. 