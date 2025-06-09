# Azure Deployment Guide for Snake Royale

This guide will help you deploy the Snake Royale game to Azure Container Instances in a cost-effective way.

## Prerequisites

1. **Azure Account**: You need an active Azure subscription
2. **Azure CLI**: Install Azure CLI on your local machine
3. **GitHub Account**: For CI/CD pipeline setup

## Cost Optimization Strategy

The deployment uses Azure Container Instances (ACI) which is ideal for this type of application because:
- **Pay-per-second billing**: Only pay when the game is running
- **Auto-scaling**: Can handle traffic spikes during keynote sessions
- **No infrastructure management**: Serverless container hosting
- **Quick startup**: Fast deployment and scaling

### Estimated Costs (per month for 200-300 concurrent users):
- **Development/Testing**: ~$10-20/month (running 8 hours/day)
- **Production/Event**: ~$50-100/month (with autoscaling during events)
- **Storage**: ~$5/month for container registry

## Step 1: Set Up Azure Resources

### 1.1 Create Resource Group
```bash
az group create --name snake-royale-rg --location swedencentral
```

### 1.2 Create Azure Container Registry
```bash
az acr create --resource-group snake-royale-rg --name YOUR_REGISTRY_NAME --sku Basic --location swedencentral
```

**Note**: Replace `YOUR_REGISTRY_NAME` with a unique name (e.g., "snakeregistry")

### 1.3 Enable Admin Access
```bash
az acr update -n YOUR_REGISTRY_NAME --admin-enabled true
```

### 1.4 Get Registry Credentials
```bash
az acr credential show --name YOUR_REGISTRY_NAME
```
Save the username and password for later use.

## Step 2: Configure GitHub Secrets

In your GitHub repository, go to Settings > Secrets and variables > Actions, and add these secrets:

### 2.1 Azure Service Principal
Create a service principal for GitHub Actions:
```bash
az ad sp create-for-rbac --name "snake-royale-github" --role contributor --scopes /subscriptions/{subscription-id}/resourceGroups/snake-royale-rg --sdk-auth
```

Add the output as `AZURE_CREDENTIALS` secret in GitHub.

### 2.2 Container Registry Secrets
Add these secrets from the ACR credentials:
- `ACR_USERNAME`: The registry username
- `ACR_PASSWORD`: The registry password

## Step 3: Deploy Using GitHub Actions

1. Push your code to the `main` branch for production deployment
2. The GitHub Action will automatically:
   - Build the Docker image
   - Push it to Azure Container Registry
   - Deploy to Azure Container Instances with stable production URL
   - Provide the deployment URL

For development testing:
1. Create a pull request against the `main` branch
2. The GitHub Action will automatically:
   - Deploy to a separate development container instance
   - Use a PR-specific URL for testing
   - Allow testing before merging to production

## Step 4: Manual Deployment (Alternative)

If you prefer manual deployment:

### 4.1 Build and Push Docker Image
```bash
# Build the image
docker build -t YOUR_REGISTRY_NAME.azurecr.io/snakeroyale:latest .

# Log in to ACR
az acr login --name YOUR_REGISTRY_NAME

# Push the image
docker push YOUR_REGISTRY_NAME.azurecr.io/snakeroyale:latest
```

### 4.2 Deploy to Container Instances

For production deployment:
```bash
az container create \
  --resource-group snake-royale-rg \
  --name snake-royale-prod-ci \
  --image YOUR_REGISTRY_NAME.azurecr.io/snakeroyale:latest \
  --registry-login-server YOUR_REGISTRY_NAME.azurecr.io \
  --registry-username [ACR_USERNAME] \
  --registry-password [ACR_PASSWORD] \
  --dns-name-label snake-royale-prod \
  --ports 3000 \
  --cpu 2 \
  --memory 4 \
  --environment-variables PORT=3000 NODE_ENV=production \
  --restart-policy Always \
  --location swedencentral \
  --os-type Linux
```

For development/testing deployment:
```bash
az container create \
  --resource-group snake-royale-rg \
  --name snake-royale-dev-ci \
  --image YOUR_REGISTRY_NAME.azurecr.io/snakeroyale:latest \
  --registry-login-server YOUR_REGISTRY_NAME.azurecr.io \
  --registry-username [ACR_USERNAME] \
  --registry-password [ACR_PASSWORD] \
  --dns-name-label snake-royale-dev-test \
  --ports 3000 \
  --cpu 2 \
  --memory 4 \
  --environment-variables PORT=3000 NODE_ENV=development \
  --restart-policy Always \
  --location swedencentral \
  --os-type Linux
```

## Step 5: Access Your Game

After deployment, you'll get URLs like:
- **Player Game**: `http://snake-royale-sweden.swedencentral.azurecontainer.io:3000`
- **Spectator View**: `http://snake-royale-sweden.swedencentral.azurecontainer.io:3000/spectator.html`

## Step 6: Scaling for Events

### For High-Traffic Events (200-300 users):

1. **Scale up before the event**:
```bash
az container update \
  --resource-group snake-royale-rg \
  --name snake-royale-ci \
  --cpu 4 \
  --memory 8
```

2. **Monitor during the event**:
```bash
az container logs --resource-group snake-royale-rg --name snake-royale-ci --follow
```

3. **Scale down after the event**:
```bash
az container update \
  --resource-group snake-royale-rg \
  --name snake-royale-ci \
  --cpu 2 \
  --memory 4
```

### Alternative: Use Azure Container Apps for Auto-scaling
For automatic scaling, consider Azure Container Apps:
```bash
az containerapp create \
  --name snake-royale-app \
  --resource-group snake-royale-rg \
  --environment snake-royale-env \
  --image snakeregistry.azurecr.io/snakeroyale:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 10 \
  --cpu 2 \
  --memory 4Gi
```

## Step 7: HTTPS Setup (Production Recommended)

### Option A: Azure Application Gateway (Recommended)

For production deployments, enable HTTPS using Azure Application Gateway:

1. **Run the HTTPS setup script**:
   ```bash
   ./azure-https-setup.sh
   ```

2. **Or manually configure**:
   ```bash
   # Create Virtual Network
   az network vnet create \
     --resource-group snake-royale-rg \
     --name snake-royale-vnet \
     --address-prefix 10.0.0.0/16 \
     --subnet-name appgw-subnet \
     --subnet-prefix 10.0.1.0/24

   # Create Public IP
   az network public-ip create \
     --resource-group snake-royale-rg \
     --name snake-royale-appgw-ip \
     --allocation-method Static \
     --sku Standard \
     --dns-name snake-royale-https

   # Get container IP
   CONTAINER_IP=$(az container show \
     --resource-group snake-royale-rg \
     --name snake-royale-prod-ci \
     --query ipAddress.ip --output tsv)

   # Create Application Gateway
   az network application-gateway create \
     --resource-group snake-royale-rg \
     --name snake-royale-appgw \
     --vnet-name snake-royale-vnet \
     --subnet appgw-subnet \
     --public-ip-address snake-royale-appgw-ip \
     --servers $CONTAINER_IP \
     --http-settings-port 3000 \
     --frontend-port 443 \
     --capacity 2
   ```

3. **Configure SSL Certificate**:
   - Obtain SSL certificate for your domain
   - Upload to Application Gateway:
   ```bash
   az network application-gateway ssl-cert create \
     --resource-group snake-royale-rg \
     --gateway-name snake-royale-appgw \
     --name ssl-cert \
     --cert-file /path/to/certificate.pfx \
     --cert-password YourPassword
   ```

### Option B: Azure Front Door (Global CDN)

For global distribution with HTTPS:

1. **Create Front Door profile**:
   ```bash
   az afd profile create \
     --resource-group snake-royale-rg \
     --profile-name snake-royale-fd \
     --sku Standard_AzureFrontDoor
   ```

2. **Configure endpoint and origin**:
   ```bash
   # Get container FQDN
   CONTAINER_FQDN=$(az container show \
     --resource-group snake-royale-rg \
     --name snake-royale-prod-ci \
     --query ipAddress.fqdn --output tsv)

   # Create origin
   az afd origin create \
     --resource-group snake-royale-rg \
     --profile-name snake-royale-fd \
     --origin-group-name default \
     --origin-name container-origin \
     --host-name $CONTAINER_FQDN \
     --origin-host-header $CONTAINER_FQDN \
     --http-port 3000
   ```

### HTTPS Configuration Status

The application is **HTTPS-ready** with the following features:
- ✅ Server supports HTTPS when certificates are available
- ✅ Environment variables control HTTP/HTTPS mode
- ✅ Automatic fallback to HTTP when certificates are missing
- ✅ WebSocket connections automatically adapt to protocol
- ✅ Ready for Azure Application Gateway SSL termination

**Current URLs** (before SSL termination):
- Game: `http://[container-fqdn]:3000`
- Spectator: `http://[container-fqdn]:3000/spectator.html`

**After HTTPS setup**:
- Game: `https://[your-domain]`
- Spectator: `https://[your-domain]/spectator.html`

## Step 8: Monitoring and Maintenance

### View Logs
Production:
```bash
az container logs --resource-group snake-royale-rg --name snake-royale-prod-ci
```

Development:
```bash
az container logs --resource-group snake-royale-rg --name snake-royale-dev-ci
```

### Check Status
Production:
```bash
az container show --resource-group snake-royale-rg --name snake-royale-prod-ci --query "{Status:instanceView.state,IP:ipAddress.ip,FQDN:ipAddress.fqdn}"
```

Development:
```bash
az container show --resource-group snake-royale-rg --name snake-royale-dev-ci --query "{Status:instanceView.state,IP:ipAddress.ip,FQDN:ipAddress.fqdn}"
```

### Update Deployment
Production:
```bash
az container update \
  --resource-group snake-royale-rg \
  --name snake-royale-prod-ci \
  --image snakeregistry.azurecr.io/snakeroyale:latest
```

Development:
```bash
az container update \
  --resource-group snake-royale-rg \
  --name snake-royale-dev-ci \
  --image snakeregistry.azurecr.io/snakeroyale:latest
```

## Step 9: Clean Up Resources

To avoid ongoing charges, stop containers when not needed:

### Stop containers individually:
```bash
# Stop production container
az container stop --resource-group snake-royale-rg --name snake-royale-prod-ci

# Stop development container  
az container stop --resource-group snake-royale-rg --name snake-royale-dev-ci

# Delete containers individually
az container delete --resource-group snake-royale-rg --name snake-royale-prod-ci --yes
az container delete --resource-group snake-royale-rg --name snake-royale-dev-ci --yes
```

### Delete entire resource group (WARNING: This deletes everything):
```bash
az group delete --name snake-royale-rg --yes --no-wait
```

## Troubleshooting

### Common Issues:

1. **Container won't start**: Check logs with `az container logs`
2. **High latency**: Scale up CPU/memory or use closer Azure region
3. **Connection issues**: Verify ports and firewall settings
4. **Build failures**: Check Dockerfile and dependencies

### Performance Tips:

1. **Use Azure regions close to your audience**
2. **Enable sticky sessions** if deploying multiple instances
3. **Use CDN** for static assets if needed
4. **Monitor WebSocket connections** for stability

## Cost Management

1. **Set up billing alerts** in Azure portal
2. **Use Azure Cost Management** to track spending
3. **Schedule container shutdown** outside of event hours
4. **Consider Azure Reserved Instances** for predictable workloads

## Security Considerations

1. **HTTPS Enabled** ✅ - Application supports HTTPS with Azure Application Gateway
2. **SSL Termination** - Use Azure Application Gateway or Azure Front Door
3. **Certificate Management** - Use Azure Key Vault for certificate storage
4. **Environment Variables** - USE_HTTPS=true enables HTTPS mode
5. **Network Security** - Configure network security groups if needed
6. **Container Security** - Regular security updates of base images
7. **Secret Management** - Use Azure Key Vault for sensitive data

## Support

For issues with deployment:
1. Check Azure documentation
2. Use Azure support forums
3. Monitor GitHub Actions logs
4. Check container health endpoints