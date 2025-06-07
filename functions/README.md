# Firebase Cloud Functions - Vectorización Automática

Este directorio contiene las Firebase Cloud Functions que manejan la vectorización automática de contactos.

## Funciones Disponibles

### 1. `onContactStatusChange` (Trigger de Firestore)
**Propósito**: Vectoriza automáticamente contactos cuando su estado cambia a `completed`.

**Trigger**: `contacts/{contactId}` - `onUpdate`

**Comportamiento**:
- Se ejecuta cuando se actualiza cualquier documento en la colección `contacts`
- Verifica si el campo `status` cambió a `completed`
- Si es así, vectoriza automáticamente el contacto
- Guarda el vector en la colección `vectorized-contacts`

### 2. `vectorizeContact` (Callable Function)
**Propósito**: Vectoriza manualmente un contacto específico.

**Uso**:
```javascript
const result = await firebase.functions().httpsCallable('vectorizeContact')({
  contactId: 'contact_jid_here'
});
```

### 3. `vectorizeBatch` (Callable Function)
**Propósito**: Vectoriza múltiples contactos en lotes.

**Parámetros**:
- `limit` (opcional): Número máximo de contactos a procesar (default: 20, max: 100)
- `forceRevectorize` (opcional): Si re-vectorizar contactos ya procesados (default: false)

**Uso**:
```javascript
const result = await firebase.functions().httpsCallable('vectorizeBatch')({
  limit: 50,
  forceRevectorize: false
});
```

### 4. `scheduledVectorization` (Scheduled Function)
**Propósito**: Vectorización programada cada hora para procesar contactos perdidos.

**Schedule**: `every 60 minutes`

**Comportamiento**:
- Se ejecuta automáticamente cada hora
- Busca contactos con estado `completed` que no han sido vectorizados
- Procesa máximo 10 contactos por ejecución

## Configuración

### Variables de Entorno

#### Método 1: Firebase Config (Recomendado)
```bash
firebase functions:config:set openai.api_key="tu_openai_api_key"
```

#### Método 2: Variables de Entorno (.env)
Crear archivo `.env` en el directorio `functions/`:
```env
OPENAI_API_KEY=tu_openai_api_key
```

### Despliegue

1. **Instalar dependencias**:
```bash
cd functions
npm install
```

2. **Compilar TypeScript**:
```bash
npm run build
```

3. **Desplegar**:
```bash
firebase deploy --only functions
```

4. **Desplegar función específica**:
```bash
firebase deploy --only functions:onContactStatusChange
```

### Desarrollo Local

1. **Instalar Firebase CLI**:
```bash
npm install -g firebase-tools
```

2. **Iniciar emuladores**:
```bash
firebase emulators:start
```

3. **Compilación en tiempo real**:
```bash
cd functions
npm run build:watch
```

## Monitoreo

### Logs
```bash
# Ver logs en tiempo real
firebase functions:log

# Ver logs de función específica
firebase functions:log --only onContactStatusChange
```

### Métricas
- Número de contactos vectorizados
- Errores de vectorización
- Tiempo de procesamiento
- Uso de memoria

## Estructura del Proyecto

```
functions/
├── src/
│   ├── index.ts              # Funciones principales
│   ├── types/
│   │   └── interfaces.ts     # Tipos e interfaces
│   └── services/
│       └── vectorization.ts  # Lógica de vectorización
├── package.json
├── tsconfig.json
└── README.md
```

## Requisitos

- Node.js 18+
- Firebase CLI
- Cuenta de OpenAI con API key
- Proyecto Firebase configurado

## Costos Estimados

### OpenAI API
- Modelo: `text-embedding-3-small`
- Costo: ~$0.00002 por 1K tokens
- Contacto promedio: ~100 tokens
- **Costo por contacto: ~$0.000002**

### Firebase Functions
- Invocaciones: Primer 1M gratis/mes
- Tiempo de cómputo: Primeros 400K GB-segundos gratis/mes
- **Costo estimado: Mínimo para volúmenes normales**

## Solución de Problemas

### Error: "OpenAI API key not configured"
1. Verificar configuración: `firebase functions:config:get`
2. Configurar API key: `firebase functions:config:set openai.api_key="KEY"`
3. Redesplegar funciones

### Error: "Insufficient information to vectorize"
- El contacto necesita información de LinkedIn o email
- Verificar que el flujo de bienvenida haya completado correctamente

### Función no se ejecuta
1. Verificar logs: `firebase functions:log`
2. Verificar que el trigger esté correctamente configurado
3. Verificar permisos de Firestore

### Timeout en funciones batch
- Reducir el parámetro `limit`
- Las funciones tienen un timeout de 9 minutos

## Mejores Prácticas

1. **Configuración de variables**: Usar Firebase config en lugar de variables de entorno
2. **Manejo de errores**: Las funciones no fallan el flujo principal si hay errores
3. **Rate limiting**: Se incluyen pausas entre llamadas a la API
4. **Logging**: Logs detallados para debugging y monitoreo
5. **Idempotencia**: Las funciones pueden ejecutarse múltiples veces sin efectos secundarios

## Próximas Mejoras

- [ ] Métricas personalizadas con Firebase Analytics
- [ ] Notificaciones de errores vía email/Slack
- [ ] Retry automático con backoff exponencial
- [ ] Paralelización de vectorización en lotes
- [ ] Cache de embeddings para contactos similares 