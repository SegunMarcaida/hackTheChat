# 🚀 Configuración Rápida de Firebase Cloud Functions

Esta guía te ayudará a configurar las Firebase Cloud Functions para vectorización automática de contactos.

## 📋 Requisitos Previos

1. **Node.js 18+** instalado
2. **Firebase CLI** instalado globalmente:
   ```bash
   npm install -g firebase-tools
   ```
3. **Proyecto Firebase** creado en la consola de Firebase
4. **OpenAI API Key** válida

## 🎯 Configuración Automática

### Opción 1: Script Automático (Recomendado)

Ejecuta el script de configuración:

```bash
./setup-firebase.sh
```

El script te guiará paso a paso para:
- ✅ Verificar dependencias
- ✅ Configurar proyecto Firebase
- ✅ Instalar dependencias
- ✅ Configurar OpenAI API Key
- ✅ Desplegar índices de Firestore
- ✅ Desplegar Cloud Functions

### Opción 2: Configuración Manual

#### 1. Configurar Proyecto Firebase

```bash
# Login en Firebase
firebase login

# Listar proyectos disponibles
firebase projects:list

# Configurar proyecto (reemplaza con tu ID)
firebase use tu-proyecto-firebase-id
```

#### 2. Configurar OpenAI API Key

```bash
firebase functions:config:set openai.api_key="tu_openai_api_key"
```

#### 3. Instalar Dependencias

```bash
cd functions
npm install
npm run build
cd ..
```

#### 4. Desplegar Índices y Functions

```bash
# Desplegar índices de Firestore
firebase deploy --only firestore:indexes

# Desplegar Cloud Functions
firebase deploy --only functions
```

## 🔍 Verificación

### Comprobar que las Functions están desplegadas:

```bash
firebase functions:log
```

### Comprobar configuración:

```bash
firebase functions:config:get
```

## 🎯 Funciones Desplegadas

Una vez configurado, tendrás estas funciones activas:

### 1. **`onContactStatusChange`** (Automática)
- **Trigger**: Cuando un contacto cambia a `status: 'completed'`
- **Acción**: Vectoriza automáticamente el contacto
- **Sin intervención manual requerida**

### 2. **`vectorizeContact`** (Manual)
- **Uso**: Vectorizar contacto específico
- **Llamada**: `firebase.functions().httpsCallable('vectorizeContact')`

### 3. **`vectorizeBatch`** (Manual)
- **Uso**: Vectorizar múltiples contactos en lotes
- **Llamada**: `firebase.functions().httpsCallable('vectorizeBatch')`

### 4. **`scheduledVectorization`** (Programada)
- **Frecuencia**: Cada 60 minutos
- **Acción**: Vectoriza contactos que se pudieron haber perdido

## 📊 Monitoreo

### Ver logs en tiempo real:
```bash
firebase functions:log
```

### Ver logs de función específica:
```bash
firebase functions:log --only onContactStatusChange
```

### Ver métricas en Firebase Console:
1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Seleccionar tu proyecto
3. Ir a **Functions**
4. Ver métricas de ejecución, errores y performance

## 🔧 Desarrollo Local

### Emular functions localmente:
```bash
firebase emulators:start
```

### Compilación en tiempo real:
```bash
cd functions
npm run build:watch
```

## ⚠️ Solución de Problemas

### Error: "No currently active project"
```bash
firebase use tu-proyecto-id
```

### Error: "OpenAI API key not configured"
```bash
firebase functions:config:set openai.api_key="tu_api_key"
firebase deploy --only functions
```

### Error de compilación TypeScript
```bash
cd functions
npm run build
```

### Functions no se ejecutan
1. Verificar logs: `firebase functions:log`
2. Verificar permisos de Firestore
3. Verificar que el contacto realmente cambió a `completed`

## 💰 Costos Estimados

### Firebase Functions
- **1M invocaciones gratis/mes**
- **400K GB-segundos gratis/mes**
- Costo adicional muy bajo para volúmenes normales

### OpenAI API
- **Modelo**: `text-embedding-3-small`
- **Costo**: ~$0.000002 por contacto
- **Muy económico** para la mayoría de casos de uso

## 🎉 ¡Listo!

Una vez configurado, el sistema funcionará completamente automático:

1. **Contacto completa flujo** → `status: 'completed'`
2. **Cloud Function se activa** → `onContactStatusChange`
3. **Vectorización automática** → Guarda en `vectorized-contacts`
4. **Búsqueda disponible** → Inmediatamente lista para usar

¡No necesitas hacer nada más! El sistema vectorizará automáticamente todos los contactos que completen el flujo de bienvenida. 🚀 