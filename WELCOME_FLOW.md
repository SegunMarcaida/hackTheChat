# 🤖 Flujo de Bienvenida Inteligente - WhatsApp Bot

Este documento explica cómo funciona el sistema de flujo de bienvenida automático **con IA** para contactos nuevos en el bot de WhatsApp.

## ✨ Características

- **Detección automática de contactos nuevos**: El bot detecta cuando alguien le escribe por primera vez
- **🧠 Mensajes generados por IA**: Utiliza OpenAI para crear mensajes personalizados y únicos para cada contacto
- **Personalización inteligente**: Los mensajes se adaptan al nombre del contacto y contexto
- **Recolección de email**: Solicita y valida la dirección de correo electrónico del contacto
- **Estados del flujo**: Maneja diferentes estados para guiar al usuario paso a paso
- **Fallback inteligente**: Si la IA falla, usa mensajes estáticos de respaldo
- **Configuración flexible**: Permite personalizar mensajes, IA y comportamiento

## 🆕 **Novedad: IA Integrada**

Cada mensaje del flujo de bienvenida ahora es **generado dinámicamente por OpenAI**, lo que significa:

- ✅ **Mensajes únicos** para cada contacto
- ✅ **Personalización automática** usando el nombre del contacto
- ✅ **Tono natural y conversacional**
- ✅ **Variedad en las respuestas** (no son repetitivos)
- ✅ **Adaptación al contexto** específico

## 🔄 Estados del Flujo

El sistema maneja los siguientes estados:

1. **NEW** - Contacto recién detectado
2. **WELCOME_SENT** - Mensaje de bienvenida enviado (generado por IA)
3. **WAITING_EMAIL** - Esperando que el usuario proporcione su email
4. **COMPLETED** - Flujo completado exitosamente

## 📱 Ejemplo de Conversación (IA Habilitada)

```
👤 Usuario: Hola

🤖 Bot: ¡Hola Juan! 👋 

¡Qué gusto saludarte! Soy tu asistente virtual inteligente y estoy aquí para hacer tu experiencia increíble.

**¿Qué puedo hacer por ti?** 🚀
✓ Responder tus preguntas al instante
✓ Ayudarte con información específica
✓ Asistirte en lo que necesites

Para ofrecerte un servicio súper personalizado, me encantaría conocer tu email. 

📧 **¿Podrías compartirme tu correo electrónico?**

👤 Usuario: juan@example.com

🤖 Bot: ¡Excelente, Juan! 🎉

Perfecto, ya tienes acceso completo a todas mis funciones. Tu email está guardado de forma segura.

**¡Ahora sí, a por todas!** ¿En qué te puedo ayudar hoy? Estoy listo para asistirte en lo que necesites. 💪
```

*Nota: Cada mensaje será diferente y personalizado según el contacto*

## ⚙️ Configuración

### Ubicación del archivo de configuración
`src/config/welcomeFlow.ts`

### Opciones principales

```typescript
export const welcomeFlowConfig = {
    // Habilitar/deshabilitar el flujo
    enabled: true,
    
    // 🧠 CONFIGURACIÓN DE IA
    ai: {
        enabled: true,              // Usar OpenAI para mensajes dinámicos
        fallbackToStatic: true,     // Usar mensajes estáticos si IA falla
        timeout: 10000,             // Timeout para llamadas a OpenAI (ms)
    },
    
    // Mensajes estáticos de fallback
    messages: {
        greeting: "Mensaje estático de bienvenida...",
        emailRequest: "Solicitud estática de email...",
        // etc...
    },
    
    // Comportamiento
    behavior: {
        requestEmailImmediately: true,
        processGroups: false,
        // etc...
    }
}
```

### 🧠 Configuración de IA

#### Habilitar/Deshabilitar IA
```typescript
ai: {
    enabled: true,  // true = Usar IA, false = Solo mensajes estáticos
}
```

#### Configurar Fallback
```typescript
ai: {
    enabled: true,
    fallbackToStatic: true,  // Si IA falla, usar mensajes estáticos
}
```

#### Timeout de IA
```typescript
ai: {
    timeout: 10000,  // Máximo 10 segundos para generar mensaje
}
```

## 🎯 Tipos de Mensajes Generados por IA

### 1. **Mensaje de Bienvenida**
- Personalizado con el nombre del contacto
- Explicación de capacidades del bot
- Solicitud amigable de email
- Tono profesional pero cercano

### 2. **Solicitud de Email**
- Recordatorio amable para proporcionar email
- Explicación del beneficio
- Personalizado si tiene nombre

### 3. **Confirmación de Email**
- Agradecimiento por proporcionar email
- Confirmación de registro completo
- Invitación a usar el servicio

### 4. **Error de Email**
- Mensaje comprensivo (no regaña)
- Explicación del formato correcto
- Motivación para intentar nuevamente

## 🛠️ Personalización Avanzada

### Modificar Prompts de IA

Los prompts están definidos en `src/ai/openai.ts`:

```typescript
// Ejemplo de personalización del prompt de bienvenida
const systemPrompt = `Eres un asistente virtual [TU_MARCA]. 
Tu tarea es generar un mensaje de bienvenida...

INSTRUCCIONES PERSONALIZADAS:
- Menciona que representas a [TU_EMPRESA]
- Usa un tono [formal/informal/amigable]
- Incluye información sobre [TUS_SERVICIOS_ESPECÍFICOS]
...`
```

### Modo Solo IA vs Híbrido

```typescript
// Solo IA (sin fallback)
ai: {
    enabled: true,
    fallbackToStatic: false,  // Si IA falla, el bot arrojará error
}

// Híbrido (recomendado)
ai: {
    enabled: true,
    fallbackToStatic: true,   // Mejor experiencia para el usuario
}
```

## 🔍 Logging y Monitoreo

### Logs de IA
```
✨ AI-generated welcome message (contactName: Juan, length: 245)
⚠️  AI message generation failed for emailRequest, using fallback
```

### Métricas Recomendadas
- **Tasa de éxito de IA**: % de mensajes generados exitosamente
- **Tiempo de respuesta de IA**: Latencia promedio
- **Uso de fallback**: Frecuencia de usar mensajes estáticos
- **Personalización efectiva**: Mensajes que usan el nombre vs genéricos

## 🚀 Ventajas de la IA Integrada

### ✅ **Beneficios para el Negocio**
- **Mejor engagement**: Mensajes únicos generan más interés
- **Personalización automática**: Cada contacto se siente especial
- **Escalabilidad**: No hay que escribir cientos de variaciones
- **Profesionalismo**: IA mantiene calidad consistente

### ✅ **Beneficios Técnicos**
- **Mantenimiento reducido**: No hay que actualizar mensajes manualmente
- **Flexibilidad**: Fácil cambio de tono o estilo via prompts
- **Robustez**: Fallback garantiza funcionamiento continuo
- **Analytics**: Logs detallados para optimización

## 🔧 Integración con IA Principal

El flujo de bienvenida tiene **prioridad sobre la IA principal**:

1. **Contacto nuevo** → Flujo de bienvenida (IA específica)
2. **Flujo completado** → IA principal para conversaciones normales
3. **Flujo en progreso** → Solo respuestas del flujo de bienvenida

## 📈 Próximas Mejoras con IA

- [ ] **Detección de intenciones** en mensajes iniciales
- [ ] **A/B testing** automático de diferentes estilos
- [ ] **Aprendizaje de preferencias** por contacto
- [ ] **Múltiples personalidades** del bot según contexto
- [ ] **Integración con datos del CRM** para ultra-personalización

## 🔧 Troubleshooting

### ¿La IA no funciona?
1. Verificar que `OPENAI_API_KEY` esté configurada
2. Revisar logs por errores de API
3. Confirmar que `ai.enabled: true` en configuración

### ¿Mensajes muy repetitivos?
1. Ajustar `temperature` en las llamadas a OpenAI
2. Modificar prompts para más variedad
3. Verificar que la IA esté habilitada correctamente

### ¿Respuestas muy largas o cortas?
1. Ajustar `max_tokens` en `src/ai/openai.ts`
2. Modificar instrucciones de longitud en prompts

---

**¿Necesitas ayuda?** Revisa los logs del sistema, verifica la configuración de OpenAI, o contacta al equipo de desarrollo. 