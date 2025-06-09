#!/bin/bash

# Azure Application Gateway Setup for HTTPS
# This script sets up Azure Application Gateway with SSL termination for Snake Royale

set -e

# Configuration variables
RESOURCE_GROUP="snake-royale-rg"
LOCATION="swedencentral"
VNET_NAME="snake-royale-vnet"
SUBNET_NAME="appgw-subnet"
APP_GATEWAY_NAME="snake-royale-appgw"
PUBLIC_IP_NAME="snake-royale-appgw-ip"
BACKEND_CONTAINER_NAME="snake-royale-prod-ci"  # Change for dev: snake-royale-dev-ci

echo "🚀 Setting up HTTPS for Snake Royale using Azure Application Gateway"

# Create Virtual Network if it doesn't exist
echo "📡 Creating Virtual Network..."
az network vnet create \
  --resource-group $RESOURCE_GROUP \
  --name $VNET_NAME \
  --location $LOCATION \
  --address-prefix 10.0.0.0/16 \
  --subnet-name $SUBNET_NAME \
  --subnet-prefix 10.0.1.0/24

# Create Public IP for Application Gateway
echo "🌐 Creating Public IP..."
az network public-ip create \
  --resource-group $RESOURCE_GROUP \
  --name $PUBLIC_IP_NAME \
  --location $LOCATION \
  --allocation-method Static \
  --sku Standard \
  --dns-name snake-royale-https

# Get the container instance IP
echo "🔍 Getting container instance IP..."
CONTAINER_IP=$(az container show \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_CONTAINER_NAME \
  --query ipAddress.ip \
  --output tsv)

if [ -z "$CONTAINER_IP" ]; then
  echo "❌ Error: Container instance not found or not running"
  echo "Please ensure the container is deployed first"
  exit 1
fi

echo "📦 Found container at IP: $CONTAINER_IP"

# Create Application Gateway with HTTP backend (container doesn't have SSL)
echo "🛡️  Creating Application Gateway..."
az network application-gateway create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_GATEWAY_NAME \
  --location $LOCATION \
  --vnet-name $VNET_NAME \
  --subnet $SUBNET_NAME \
  --public-ip-address $PUBLIC_IP_NAME \
  --servers $CONTAINER_IP \
  --http-settings-port 3000 \
  --http-settings-protocol Http \
  --frontend-port 443 \
  --capacity 2 \
  --sku Standard_v2

# Get the public IP for SSL certificate setup
PUBLIC_IP=$(az network public-ip show \
  --resource-group $RESOURCE_GROUP \
  --name $PUBLIC_IP_NAME \
  --query ipAddress \
  --output tsv)

echo "✅ Application Gateway created successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Point your domain to: $PUBLIC_IP"
echo "2. Obtain SSL certificate for your domain"
echo "3. Upload certificate to Application Gateway:"
echo ""
echo "   az network application-gateway ssl-cert create \\"
echo "     --resource-group $RESOURCE_GROUP \\"
echo "     --gateway-name $APP_GATEWAY_NAME \\"
echo "     --name ssl-cert \\"
echo "     --cert-file /path/to/your/certificate.pfx \\"
echo "     --cert-password YourCertPassword"
echo ""
echo "4. Update HTTPS listener:"
echo ""
echo "   az network application-gateway http-listener update \\"
echo "     --resource-group $RESOURCE_GROUP \\"
echo "     --gateway-name $APP_GATEWAY_NAME \\"
echo "     --name appGatewayHttpListener \\"
echo "     --ssl-cert ssl-cert"
echo ""
echo "🌐 Your application will be available at: https://snake-royale-https.swedencentral.cloudapp.azure.com"
echo "📍 Public IP: $PUBLIC_IP"
echo ""
echo "For automatic SSL certificate management, consider using:"
echo "- Azure Key Vault for certificate storage"
echo "- Let's Encrypt with cert-manager"
echo "- Azure managed certificates (for custom domains)"