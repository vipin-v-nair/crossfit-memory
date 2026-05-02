import google.auth
from google.auth.transport.requests import Request

def main():
    try:
        credentials, project = google.auth.default()
        print(f"Default project: {project}")
        print(f"Credentials type: {type(credentials)}")
        
        # Try to refresh/validate
        credentials.refresh(Request())
        
        if hasattr(credentials, "service_account_email"):
            print(f"Service Account Email: {credentials.service_account_email}")
        elif hasattr(credentials, "signer_email"):
            print(f"Signer Email: {credentials.signer_email}")
        else:
            print("No explicit email found in credentials (might be user credentials).")
            
    except Exception as e:
        print(f"Error getting credentials: {e}")

if __name__ == "__main__":
    main()
