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
az acr create --resource-group snake-royale-rg --name snakeregistry --sku Basic --location swedencentral
```

### 1.3 Enable Admin Access
```bash
az acr update -n snakeregistry --admin-enabled true
```

### 1.4 Get Registry Credentials
```bash
az acr credential show --name snakeregistry
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

1. Push your code to the `main` branch
2. The GitHub Action will automatically:
   - Build the Docker image
   - Push it to Azure Container Registry
   - Deploy to Azure Container Instances
   - Provide the deployment URL

## Step 4: Manual Deployment (Alternative)

If you prefer manual deployment:

### 4.1 Build and Push Docker Image
```bash
# Build the image
docker build -t snakeregistry.azurecr.io/snakeroyale:latest .

# Log in to ACR
az acr login --name snakeregistry

# Push the image
docker push snakeregistry.azurecr.io/snakeroyale:latest
```

### 4.2 Deploy to Container Instances
```bash
az container create \
  --resource-group snake-royale-rg \
  --name snake-royale-ci \
  --image snakeregistry.azurecr.io/snakeroyale:latest \
  --registry-login-server snakeregistry.azurecr.io \
  --registry-username [ACR_USERNAME] \
  --registry-password [ACR_PASSWORD] \
  --dns-name-label snake-royale-unique \
  --ports 3000 \
  --cpu 2 \
  --memory 4 \
  --environment-variables PORT=3000 NODE_ENV=production \
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

## Step 7: Custom Domain (Optional)

1. **Register a domain** or use a subdomain
2. **Set up DNS** to point to your container instance
3. **Configure SSL** using Azure Application Gateway or Cloudflare

## Step 8: Monitoring and Maintenance

### View Logs
```bash
az container logs --resource-group snake-royale-rg --name snake-royale-ci
```

### Check Status
```bash
az container show --resource-group snake-royale-rg --name snake-royale-ci --query "{Status:instanceView.state,IP:ipAddress.ip,FQDN:ipAddress.fqdn}"
```

### Update Deployment
```bash
az container update \
  --resource-group snake-royale-rg \
  --name snake-royale-ci \
  --image snakeregistry.azurecr.io/snakeroyale:latest
```

## Step 9: Clean Up Resources

To avoid ongoing charges, delete resources when not needed:
```bash
# Stop the container
az container stop --resource-group snake-royale-rg --name snake-royale-ci

# Delete the entire resource group (WARNING: This deletes everything)
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

1. **Enable HTTPS** in production
2. **Use Azure Key Vault** for secrets
3. **Configure network security groups** if needed
4. **Regular security updates** of base images

## Support

For issues with deployment:
1. Check Azure documentation
2. Use Azure support forums
3. Monitor GitHub Actions logs
4. Check container health endpoints