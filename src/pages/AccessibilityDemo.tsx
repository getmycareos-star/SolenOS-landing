import { useState } from 'react';
import { AccessibleButton } from '../components/accessible/AccessibleButton';
import { AccessibleInput } from '../components/accessible/AccessibleInput';
import { AccessibleForm } from '../components/accessible/AccessibleForm';
import { CareCapture } from '../components/CareCapture';
import { SrOnly, SrOnlyFocusable } from '../components/accessible/AccessibleButton';

/**
 * Accessibility Demo Page
 * Showcases all the accessible components implemented in SolenOS
 */
export default function AccessibilityDemo() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleSubmit = async (data: Record<string, string>) => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        setFormData(data);
        resolve();
      }, 1000);
    });
  };

  const formFields = [
    {
      label: 'Full Name',
      name: 'name',
      type: 'text',
      placeholder: 'Enter your full name',
      required: true,
      validation: (value) => {
        if (!value || value.trim() === '') {
          return 'Name is required';
        }
        if (value.length < 2) {
          return 'Name must be at least 2 characters';
        }
        return null;
      }
    },
    {
      label: 'Email Address',
      name: 'email',
      type: 'email',
      placeholder: 'Enter your email address',
      required: true,
      validation: (value) => {
        if (!value || value.trim() === '') {
          return 'Email is required';
        }
        // Simple email regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address';
        }
        return null;
      }
    },
    {
      label: 'Message',
      name: 'message',
      type: 'textarea',
      placeholder: 'Enter your message',
      required: true,
      validation: (value) => {
        if (!value || value.trim() === '') {
          return 'Message is required';
        }
        if (value.length < 10) {
          return 'Message must be at least 10 characters';
        }
        return null;
      }
    }
  ];

  if (!import.meta.env.DEV) {
    return (
      <main role="status" style={{ padding: '24px', color: 'var(--text-secondary)' }}>
        This development-only accessibility showcase is disabled in production.
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Skip to main content link */}
      <SrOnlyFocusable href="#main-content">
        Skip to main content
      </SrOnlyFocusable>

      <main id="main-content">
        <h1 className="text-3xl font-bold text-trust mb-8">
          Accessibility Demo
        </h1>
        
        <p className="text-lg text-muted-foreground mb-6">
          This page demonstrates the accessibility features implemented in SolenOS.
          Try navigating with Tab key, using screen readers, and testing form validation.
        </p>

        {/* Section 1: Accessible Buttons */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-trust mb-4">
            Accessible Buttons
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            These buttons demonstrate proper keyboard navigation, focus management,
            and ARIA attributes.
          </p>
          <div className="flex flex-wrap gap-4">
            <AccessibleButton 
              variant="primary" 
              size="medium"
              onClick={() => alert('Primary button clicked!')}
            >
              Primary Button
            </AccessibleButton>
            
            <AccessibleButton 
              variant="secondary" 
              size="medium"
              onClick={() => alert('Secondary button clicked!')}
            >
              Secondary Button
            </AccessibleButton>
            
            <AccessibleButton 
              variant="outline" 
              size="medium"
              onClick={() => alert('Outline button clicked!')}
            >
              Outline Button
            </AccessibleButton>
            
            <AccessibleButton 
              variant="danger" 
              size="medium"
              onClick={() => alert('Danger button clicked!')}
            >
              Danger Button
            </AccessibleButton>
            
            <AccessibleButton 
              variant="success" 
              size="medium"
              onClick={() => alert('Success button clicked!')}
            >
              Success Button
            </AccessibleButton>
            
            <AccessibleButton 
              variant="primary" 
              size="small"
              onClick={() => alert('Small button clicked!')}
            >
              Small
            </AccessibleButton>
            
            <AccessibleButton 
              variant="primary" 
              size="large"
              onClick={() => alert('Large button clicked!')}
            >
              Large
            </AccessibleButton>
            
            <AccessibleButton 
              variant="primary" 
              size="medium"
              iconLeft={<span role="img" aria-label="Save">💾</span>}
              onClick={() => alert('Button with icon clicked!')}
            >
              Button with Icon
            </AccessibleButton>
            
            <AccessibleButton 
              variant="outline" 
              size="medium"
              isLoading
              onClick={() => {/* Prevent default when loading */}}
            >
              Loading...
            </AccessibleButton>
            
            <AccessibleButton 
              variant="primary" 
              size="medium"
              requiresConfirmation
              confirmationMessage="Are you sure you want to delete this item?"
              onClick={() => alert('Item deleted!')}
            >
              Delete (with confirmation)
            </AccessibleButton>
          </div>
        </section>

        {/* Section 2: Accessible Inputs */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-trust mb-4">
            Accessible Inputs
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            These inputs demonstrate proper labeling, error handling,
            and screen reader announcements.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <AccessibleInput
              label="First Name"
              placeholder="Enter your first name"
              required
              validation={(value) => 
                !value || value.trim() === '' ? 'First name is required' : null
              }
              onChange={(value) => {
                setFormData(prev => ({ ...prev, firstName: value }));
              }}
            />
            
            <AccessibleInput
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              required
              validation={(value) => {
                if (!value || value.trim() === '') {
                  return 'Email is required';
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                  return 'Please enter a valid email address';
                }
                return null;
              }}
              onChange={(value) => {
                setFormData(prev => ({ ...prev, email: value }));
              }}
            />
            
            <AccessibleInput
              label="Password"
              type="password"
              placeholder="Enter your password"
              required
              validation={(value) => 
                !value || value.length < 8 ? 'Password must be at least 8 characters' : null
              }
              onChange={(value) => {
                setFormData(prev => ({ ...prev, password: value }));
              }}
              showClearButton
            />
            
            <AccessibleInput
              label="Phone Number"
              type="tel"
              placeholder="Enter your phone number"
              inputMode="tel"
              onChange={(value) => {
                setFormData(prev => ({ ...prev, phone: value }));
              }}
            />
            
            <AccessibleInput
              label="Bio (Textarea)"
              type="textarea"
              placeholder="Tell us about yourself"
              rows={4}
              onChange={(value) => {
                setFormData(prev => ({ ...prev, bio: value }));
              }}
            />
          </div>
        </section>

        {/* Section 3: Accessible Form */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-trust mb-4">
            Accessible Form
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            This form demonstrates proper form accessibility including
            field validation, error announcements, and logical tab order.
          </p>
          <AccessibleForm
            title="Contact Us"
            description="Please fill out the form below to get in touch with us."
            fields={formFields}
            submitText="Send Message"
            onSubmit={handleSubmit}
            resetOnSubmit={true}
          />
          
          {/* Display submitted data */}
          {Object.values(formData).some(v => v && v.trim() !== '') && (
            <div className="mt-8 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold text-trust mb-4">Submitted Data:</h3>
              <div className="space-y-2">
                {Object.entries(formData).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="font-medium">{key}:</span>
                    <span className="text-muted-foreground">{value || '(empty)'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Section 4: Accessible Care Capture */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-trust mb-4">
            Accessible Care Capture
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            This is the enhanced CareCapture component with accessibility improvements.
          </p>
          <CareCapture
            onCapture={(text) => {
              console.log('Care captured:', text);
              alert(`Care captured: ${text}`);
            }}
          />
        </section>

        {/* Section 5: Screen Reader Only Elements */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-trust mb-4">
            Screen Reader Only Elements
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            These elements are visible only to screen readers but not visually displayed.
          </p>
          <div className="space-y-4">
            <SrOnly>
              This text is only visible to screen readers.
            </SrOnly>
            
            <SrOnlyFocusable>
              This link is visible when focused (for skip navigation).
            </SrOnlyFocusable>
          </div>
        </section>
      </main>
    </div>
  );
}