#!/bin/bash

echo "🚀 Configurando Firebase Cloud Functions para hackTheChat..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar si Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI no está instalado.${NC}"
    echo "Instálalo con: npm install -g firebase-tools"
    exit 1
fi

echo -e "${GREEN}✅ Firebase CLI encontrado${NC}"

# Verificar si el usuario está loggeado
if ! firebase projects:list &> /dev/null; then
    echo -e "${YELLOW}🔐 Necesitas hacer login en Firebase...${NC}"
    firebase login
fi

echo -e "${GREEN}✅ Usuario autenticado${NC}"

# Listar proyectos disponibles
echo -e "${YELLOW}📋 Proyectos disponibles:${NC}"
firebase projects:list

echo ""
echo -e "${YELLOW}🔧 Configurando proyecto...${NC}"

# Si el proyecto hack-the-chat no existe, preguntar por el nombre del proyecto
read -p "¿Cuál es el ID de tu proyecto Firebase? (por ejemplo: hack-the-chat-abc123): " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ ID de proyecto no puede estar vacío${NC}"
    exit 1
fi

# Actualizar .firebaserc con el proyecto correcto
cat > .firebaserc << EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF

echo -e "${GREEN}✅ Archivo .firebaserc actualizado con proyecto: $PROJECT_ID${NC}"

# Usar el proyecto
firebase use $PROJECT_ID

echo -e "${GREEN}✅ Proyecto configurado: $PROJECT_ID${NC}"

# Instalar dependencias de functions
echo -e "${YELLOW}📦 Instalando dependencias de Cloud Functions...${NC}"
cd functions
npm install

echo -e "${GREEN}✅ Dependencias instaladas${NC}"

# Compilar TypeScript
echo -e "${YELLOW}🔨 Compilando TypeScript...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Compilación exitosa${NC}"
else
    echo -e "${RED}❌ Error en la compilación${NC}"
    exit 1
fi

cd ..

# Configurar OpenAI API Key
echo ""
echo -e "${YELLOW}🔑 Configuración de OpenAI API Key${NC}"
read -p "Ingresa tu OpenAI API Key: " OPENAI_API_KEY

if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ OpenAI API Key no puede estar vacía${NC}"
    exit 1
fi

# Configurar la API key en Firebase
firebase functions:config:set openai.api_key="$OPENAI_API_KEY"

echo -e "${GREEN}✅ OpenAI API Key configurada${NC}"

# Desplegar índices de Firestore
echo -e "${YELLOW}📊 Desplegando índices de Firestore...${NC}"
firebase deploy --only firestore:indexes

# Preguntar si desplegar las functions
echo ""
read -p "¿Deseas desplegar las Cloud Functions ahora? (y/n): " DEPLOY_FUNCTIONS

if [ "$DEPLOY_FUNCTIONS" = "y" ] || [ "$DEPLOY_FUNCTIONS" = "Y" ]; then
    echo -e "${YELLOW}🚀 Desplegando Cloud Functions...${NC}"
    firebase deploy --only functions
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Cloud Functions desplegadas exitosamente${NC}"
    else
        echo -e "${RED}❌ Error al desplegar Cloud Functions${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ Cloud Functions no desplegadas. Puedes hacerlo más tarde con:${NC}"
    echo "firebase deploy --only functions"
fi

echo ""
echo -e "${GREEN}🎉 ¡Configuración completa!${NC}"
echo ""
echo -e "${YELLOW}📝 Comandos útiles:${NC}"
echo "  - Ver logs: firebase functions:log"
echo "  - Desplegar functions: firebase deploy --only functions"
echo "  - Emular localmente: firebase emulators:start"
echo "  - Ver configuración: firebase functions:config:get"
echo ""
echo -e "${GREEN}🚀 Las Cloud Functions se ejecutarán automáticamente cuando los contactos cambien a 'completed'${NC}" 