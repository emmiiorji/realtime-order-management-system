# Redis Setup Guide for Render Deployment

## Option 1: Redis Cloud (Recommended)

### Step 1: Create Redis Cloud Account
1. Go to [Redis Cloud](https://redis.com/redis-enterprise-cloud/)
2. Sign up for a free account
3. Verify your email

### Step 2: Create a Database
1. Click "New Database"
2. Choose "Fixed" plan (free tier - 30MB)
3. Select your preferred cloud provider and region
4. Give your database a name (e.g., "order-management-redis")
5. Click "Create Database"

### Step 3: Get Connection Details
1. Go to your database dashboard
2. Copy the connection details:
   - **Host**: Your Redis endpoint
   - **Port**: Usually 6379
   - **Password**: Your Redis password

### Step 4: Set Environment Variables in Render
```
REDIS_HOST=redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

## Option 2: Upstash Redis (Serverless)

### Step 1: Create Upstash Account
1. Go to [Upstash](https://upstash.com/)
2. Sign up with GitHub or email
3. Verify your account

### Step 2: Create Redis Database
1. Click "Create Database"
2. Choose a name for your database
3. Select a region close to your users
4. Choose "Free" tier
5. Click "Create"

### Step 3: Get Connection Details
1. Go to your database details
2. Copy the connection information:
   - **Redis URL**: Full connection string
   - Or individual **Host**, **Port**, **Password**

### Step 4: Set Environment Variables in Render
**Option A - Using full URL:**
```
REDIS_URL=redis://default:your-password@host:port
```

**Option B - Using individual settings:**
```
REDIS_HOST=your-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

## Option 3: DigitalOcean Managed Redis

### Step 1: Create DigitalOcean Account
1. Go to [DigitalOcean](https://www.digitalocean.com)
2. Sign up and verify your account

### Step 2: Create Managed Database
1. Go to "Databases" in the control panel
2. Click "Create Database Cluster"
3. Choose "Redis"
4. Select your preferred configuration
5. Choose a datacenter region
6. Click "Create Database Cluster"

### Step 3: Configure Access
1. Add connection sources (allow all IPs for Render)
2. Get connection details from the dashboard

### Step 4: Set Environment Variables
```
REDIS_HOST=your-redis-cluster.db.ondigitalocean.com
REDIS_PORT=25061
REDIS_PASSWORD=your-password
```

## Option 4: Railway Redis

### Step 1: Create Railway Account
1. Go to [Railway](https://railway.app)
2. Sign up with GitHub

### Step 2: Deploy Redis
1. Click "New Project"
2. Choose "Deploy from Template"
3. Search for "Redis"
4. Deploy the template

### Step 3: Get Connection Details
1. Go to your Redis service
2. Click on "Variables" tab
3. Copy the connection details

## Testing Your Redis Connection

After setting up Redis and configuring environment variables in Render:

1. Deploy your application
2. Check the backend logs for Redis connection messages
3. Visit your health check endpoint: `https://your-backend.onrender.com/health`
4. The health check should show Redis connection status

## Environment Variable Configuration in Render

1. Go to your Render dashboard
2. Navigate to your backend service
3. Go to "Environment" tab
4. Add the Redis environment variables based on your chosen provider

## Security Best Practices

1. **Use strong passwords**: Redis passwords should be long and complex
2. **Limit access**: Configure IP whitelisting if your provider supports it
3. **Use TLS**: Enable TLS/SSL encryption if available
4. **Monitor usage**: Set up alerts for unusual Redis activity
5. **Regular backups**: Enable persistence and backups if available

## Troubleshooting

### Connection Issues
- Verify Redis host and port are correct
- Check that the password is set correctly
- Ensure your Redis provider allows connections from Render's IPs
- Check for typos in environment variables

### Performance Issues
- Monitor Redis metrics in your provider's dashboard
- Consider upgrading to a higher tier if needed
- Optimize your Redis usage patterns

### Memory Issues
- Monitor memory usage
- Configure appropriate eviction policies
- Consider upgrading your Redis plan if needed

## Redis Configuration Notes

Your application supports both connection methods:
- **Individual settings**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- **Full URL**: `REDIS_URL` (takes precedence if set)

Choose the method that works best with your Redis provider's documentation.
