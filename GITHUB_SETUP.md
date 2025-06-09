# GitHub Actions CI/CD Setup Guide

This guide will help you set up the GitHub secrets needed for automated deployment to Azure.

## Required GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add these secrets:

**First, get your Azure credentials by running these commands:**
```bash
# Create service principal (if not already done)
az ad sp create-for-rbac --name "snake-royale-github-actions" --role contributor --scopes /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/snake-royale-rg --json-auth

# Get container registry credentials
az acr credential show --name YOUR_REGISTRY_NAME
```

### 1. AZURE_CREDENTIALS
```json
{
  "clientId": "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "subscriptionId": "YOUR_SUBSCRIPTION_ID",
  "tenantId": "YOUR_TENANT_ID",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

**Note**: Replace the placeholder values with your actual Azure service principal credentials from the setup process.

### 2. ACR_USERNAME
```
YOUR_REGISTRY_NAME
```

### 3. ACR_PASSWORD
```
YOUR_REGISTRY_PASSWORD
```

**Note**: Get these values from: `az acr credential show --name YOUR_REGISTRY_NAME`

## How to Add Secrets to GitHub

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the exact name and value shown above

### Secret Names and Values:
- **Name**: `AZURE_CREDENTIALS` | **Value**: The entire JSON object above (with your actual values)
- **Name**: `ACR_USERNAME` | **Value**: Your container registry username
- **Name**: `ACR_PASSWORD` | **Value**: Your container registry password

## How the CI/CD Pipeline Works

Once you've added these secrets, the GitHub Action will:

1. **Trigger**: On every push to the `main` branch or pull request
2. **Environment Setup**: Determines deployment environment (production vs development)
3. **Build**: Install dependencies and run tests
4. **Docker**: Build and push Docker image to Azure Container Registry
5. **Deploy**: Deploy to appropriate Azure Container Instance
   - **Main branch**: Deploys to production with stable URL
   - **Pull requests**: Deploys to development environment with PR-specific URL
6. **Output**: Provide the deployment URL in the action logs

### Deployment Environments

- **Production**: Deployed on push to main branch with stable DNS name
- **Development**: Deployed for pull requests with unique DNS name per PR

## Testing the Pipeline

1. Make a small change to your code (e.g., update a comment in `server.js`)
2. Commit and push to the `main` branch for production deployment:
   ```bash
   git add .
   git commit -m "Test CI/CD pipeline"
   git push origin main
   ```
3. Or create a pull request for development testing:
   ```bash
   git checkout -b feature/test-deployment
   git add .
   git commit -m "Test dev deployment"
   git push origin feature/test-deployment
   # Then create a PR via GitHub UI
   ```
4. Go to GitHub → Actions tab to watch the deployment
5. The action will provide the deployment URL when complete

## Current Deployment URLs

### Production Environment (main branch)
- **Game**: http://snake-royale-prod.swedencentral.azurecontainer.io:3000
- **Spectator**: http://snake-royale-prod.swedencentral.azurecontainer.io:3000/spectator.html
- **HTTPS Ready**: Configure Azure Application Gateway for SSL termination

**Note**: Production URLs remain stable across deployments. HTTPS available via Application Gateway.

### Development Environment (pull requests)
- **Game**: http://snake-royale-dev-pr-[NUMBER].swedencentral.azurecontainer.io:3000
- **Spectator**: http://snake-royale-dev-pr-[NUMBER].swedencentral.azurecontainer.io:3000/spectator.html
- **HTTPS Ready**: Configure Azure Application Gateway for SSL termination

**Note**: Development URLs are unique per PR and automatically cleaned up.

### HTTPS Setup
To enable HTTPS for your deployment:
1. Follow the instructions in `DEPLOYMENT.md` Step 7
2. Run the `azure-https-setup.sh` script
3. Configure your SSL certificate
4. Access via: `https://[your-domain]`

## Troubleshooting

### Common Issues:
1. **"Service principal not found"** → Double-check the `AZURE_CREDENTIALS` secret
2. **"Container registry access denied"** → Verify `ACR_USERNAME` and `ACR_PASSWORD`
3. **"Resource group not found"** → Ensure the service principal has access to `snake-royale-rg`

### Checking Deployment:
```bash
# View Azure container status
az container show --resource-group snake-royale-rg --name snake-royale-ci

# View container logs
az container logs --resource-group snake-royale-rg --name snake-royale-ci

# List all containers
az container list --resource-group snake-royale-rg --output table
```

## Security Notes

- The service principal has **contributor** access only to the `snake-royale-rg` resource group
- ACR credentials are scoped to the `snakeregistry` container registry only
- All secrets are encrypted and only accessible to GitHub Actions in your repository

## Updating Deployment

To update your application:
1. Make code changes
2. Push to `main` branch
3. GitHub Actions automatically builds and deploys
4. Check the Actions tab for deployment status and new URL

That's it! Your CI/CD pipeline is now ready for automated deployments! 🚀
